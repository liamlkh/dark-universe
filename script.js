

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

let mouseX = 0.5, mouseY = 0.5

const ellipses = []
const INNER_RADIUS = 200
const OUTER_RADIUS = 1000

const camera = new THREE.PerspectiveCamera(60, 1, 1, 100000)
camera.position.set(0, 0, 900)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const group = new THREE.Group()
group.position.set(0, -90, 0)
group.rotateX(Math.PI * -0.42)
group.rotateY(Math.PI * 0.05)
scene.add(group)

const composer = new EffectComposer(renderer)
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

const ellipseMaterial = new LineMaterial({
    vertexColors: true,
    alphaToCoverage: true,
    transparent: true,
    onBeforeCompile: shader => {
        shader.vertexShader = `
            ${shader.vertexShader}
        `.replace(
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

// add ellipses
let r = INNER_RADIUS
while (r <= OUTER_RADIUS ) {
    const curve = new THREE.EllipseCurve(
        0, 0,  // xCenter, yCenter
        r, r, // xRadius, yRadius
        0,  THREE.MathUtils.randFloat(0.3, 0.7) * Math.PI, // startAngle, endAngle
        true,  // clockwise
        THREE.MathUtils.randFloat(0, 2) * Math.PI  // rotation
    )
    const curvePoints = curve.getPoints( Math.round(r * 0.7) )
    
    let points = []
    let colors = []
    let lineWidths = []
    let alphas = []
    const width = THREE.MathUtils.randFloat(1, 4)
    const color = THREE.MathUtils.randFloat(0.2, 0.7)
    curvePoints.forEach((point, index) => {
        points.push(
            point.x,
            point.y,
            80 * index / curvePoints.length - 40
        )
        colors.push(color, color, color)
        if (index < curvePoints.length - 1) lineWidths.push(width * index / (curvePoints.length - 1) )
        alphas.push(index / (curvePoints.length - 1))
    })

    const ellipseGeometry = new LineGeometry()
    ellipseGeometry.setPositions(points)
    ellipseGeometry.setColors(colors)
    ellipseGeometry.setAttribute("linewidth", new THREE.InstancedBufferAttribute(new Float32Array(lineWidths), 1))
    ellipseGeometry.setAttribute("alpha", new THREE.InstancedBufferAttribute(new Float32Array(alphas), 1))
    ellipseGeometry.verticesNeedUpdate = true

    const ellipse = new Line2(ellipseGeometry, ellipseMaterial)
    ellipse.scale.set(1, 1, 1)
    group.add(ellipse)
    ellipses.push({
        mesh: ellipse,
        speed: THREE.MathUtils.randFloat(1, 5)
    })

    r += THREE.MathUtils.randFloat(1, 3)
}

// add sphere
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(INNER_RADIUS, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 'black' })
)
group.add(sphere)

// mousemove event
const onMouseMove = (event) => {
    mouseX = event.offsetX / event.target.offsetWidth
    mouseY = event.offsetY / event.target.offsetHeight
}
const onTouchMove = (e) => {
    const event = e.touches[0]
    mouseX = (event.clientX - (window.innerWidth - event.target.offsetWidth) * 0.5) / event.target.offsetWidth
    mouseY = (event.clientY - (window.innerHeight - event.target.offsetHeight) * 0.5) / event.target.offsetWidth
}
const isMobile = ('ontouchstart' in document.documentElement && navigator.userAgent.match(/Mobi/))
if (isMobile) 
    renderer.domElement.addEventListener('touchmove', onTouchMove)
else
    renderer.domElement.addEventListener('mousemove', onMouseMove)

// resize event
const resize = () => {
    let width, height
    const padding = window.innerHeight * 0.15

    height = window.innerHeight - padding

    if (window.innerWidth / window.innerHeight < 0.8) {
        width = window.innerWidth - padding
    }
    else {
        width = height * 0.8
    }

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
    composer.setSize(width, height)

    ellipseMaterial.resolution.set(width * 2, height * 2)
    savePass.renderTarget.setSize(width, height)

    document.getElementById('frame').style.width = `${width}px`
    document.getElementById('frame').style.height = `${height}px`
    document.getElementById('frame').style.setProperty('--size', `${width * 0.2}px`)
    
    document.body.classList.remove('not-ready')
}
resize()
window.addEventListener('resize', resize)

const map = (n, start1, end1, start2, end2) => {
    return ( (n - start1) / (end1 - start1) ) * (end2 - start2) + start2
}

const animate = () => {
    requestAnimationFrame(animate)
    render()

    const speed = map(mouseX, 1, 0, 0.019, 0.009)
    for (const ellipse of ellipses) {
        ellipse.mesh.rotation.z -= ellipse.speed * speed
    }

    group.rotation.x = map(mouseY, 0, 1, Math.PI * -0.47, Math.PI * -0.25) // -0.42
    group.rotation.y = map(mouseY, 0, 1, Math.PI * 0.045, Math.PI * 0.065) // 0.05
    group.matrixWorldNeedsUpdate = true
}

const render = () => {
    composer.render()
}

animate()
