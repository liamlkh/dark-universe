

import * as THREE from 'https://cdn.skypack.dev/three@0.130.1'
import { Line2 } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/lines/LineGeometry.js'
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/postprocessing/ShaderPass.js'
import { SavePass } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/postprocessing/SavePass.js'
import { CopyShader } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/shaders/CopyShader.js'
import { BlendShader } from 'https://cdn.skypack.dev/three@0.130.1/examples/jsm/shaders/BlendShader.js'

let camera, scene, group, renderer, composer
let mouseX = 0.5, mouseY = 0.5

const ellipses = []
const INNER_RADIUS = 200
const OUTER_RADIUS = 1000

const random = (min, max) => {
    return Math.random() * (max - min) + min
}

const map = (n, start1, end1, start2, end2) => {
    return ( (n - start1) / (end1 - start1) ) * (end2 - start2) + start2
}

const init = () => {

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000)
    camera.position.set(0, 0, 900)

    renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    group = new THREE.Group()
    group.position.set(0, -90, 0)
    group.rotateX(Math.PI * -0.42)
    group.rotateY(Math.PI * 0.05)
    scene.add(group)

    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    // motion blur
    // save pass
    const savePass = new SavePass(
        new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                stencilBuffer: false
            }
        )
    )
    // blend pass
    const blendPass = new ShaderPass(BlendShader, "tDiffuse1")
    blendPass.uniforms["tDiffuse2"].value = savePass.renderTarget.texture
    blendPass.uniforms["mixRatio"].value = 0.5
    // output pass
    const outputPass = new ShaderPass(CopyShader)
    outputPass.renderToScreen = true

    composer.addPass(blendPass)
    composer.addPass(savePass)
    composer.addPass(outputPass)

    // init ellipses
    let r = INNER_RADIUS
    while (r <= OUTER_RADIUS ) {
        const curve = new THREE.EllipseCurve(
            0, 0,  // xCenter, yCenter
            r, r, // xRadius, yRadius
            0,  random(0.3, 0.7) * Math.PI, // startAngle, endAngle
            true,  // clockwise
            random(0, 2) * Math.PI  // rotation
        )
        const curvePoints = curve.getPoints( Math.round(r * 0.7) )
        
        let points = []
        let colors = []
        let lineWidths = []
        let alphas = []
        const width = random(1, 4)
        const color = random(0.2, 0.7)
        curvePoints.forEach((point, index) => {
            points.push(
                point.x,
                point.y,
                80 * index / curvePoints.length - 40
            )
            colors.push(color, color, color)
            lineWidths.push(width * index / (curvePoints.length - 1) )
            alphas.push(index / (curvePoints.length - 1))
        })

        const ellipseGeometry = new LineGeometry()
        ellipseGeometry.setPositions(points)
        ellipseGeometry.setColors(colors)
        ellipseGeometry.setAttribute("linewidth", new THREE.InstancedBufferAttribute(new Float32Array(lineWidths), 1))
        ellipseGeometry.setAttribute("alpha", new THREE.InstancedBufferAttribute(new Float32Array(alphas), 1))
        const ellipseMaterial = new LineMaterial({
            vertexColors: true,
            alphaToCoverage: true,
            transparent: true,
            onBeforeCompile: shader => {
                shader.vertexShader = `
                    ${shader.vertexShader}
                ` .replace(
                    `uniform float linewidth;`, 
                    `
                        attribute float linewidth; 
                        attribute float alpha;
                        varying float vAlpha;
                    `
                ).replace(
                    `vUv = uv;`, 
                    `
                        vUv = uv;
                        vAlpha = alpha;
                    `
                )

                shader.fragmentShader = `
                    ${shader.fragmentShader}
                `.replace(
                    `uniform float opacity;`, 
                    `
                        uniform float opacity;
                        varying float vAlpha;
                    `
                ).replace(`gl_FragColor = vec4( diffuseColor.rgb, alpha );`, `gl_FragColor = vec4( diffuseColor.rgb, vAlpha );`)
            }
        })
        ellipseMaterial.resolution.set(window.innerWidth, window.innerHeight)
        const ellipse = new Line2(ellipseGeometry, ellipseMaterial)
        ellipse.computeLineDistances()
        ellipse.scale.set(1, 1, 1)
        group.add(ellipse)
        ellipses.push({
            mesh: ellipse,
            speed: random(1, 5)
        })

        r += random(1, 3)
    }

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(INNER_RADIUS, 64, 64), 
        new THREE.MeshBasicMaterial({ color: 'black' })
    )
    group.add(sphere)
}

const onMouseMove = (event) => {
    mouseX = event.clientX / window.innerWidth
    mouseY = event.clientY / window.innerHeight
}
document.addEventListener('mousemove', onMouseMove)

const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()

    renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

const animate = () => {
    requestAnimationFrame(animate)
    render()

    const speed = map(mouseY, 0, 1, 0.019, 0.009)
    for (const ellipse of ellipses) {
        ellipse.mesh.rotation.z -= ellipse.speed * speed
    }

    group.rotation.x = map(mouseX, 0, 1, Math.PI * -0.47, Math.PI * -0.37) // -0.42
    group.rotation.y = map(mouseX, 0, 1, Math.PI * 0.045, Math.PI * 0.055) // 0.05
    group.matrixWorldNeedsUpdate = true
}

const render = () => {
    composer.render()
}

init()
animate()
