import * as THREE from 'https://cdn.jsdelivr.net/npm/three@v0.113.2/build/three.module.js';

const vertexShader = `
    varying vec3 worldPos;
    void main() {
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        worldPos = position.xyz * 500.0;
        gl_Position = projectionMatrix * modelViewPosition; 
    }
`;
const fragmentShader=`
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec3 iSunDirection;

    uniform float iCloudCover;
    uniform float iCloudThickness;
    uniform float iCloudAmbient;
    uniform float iCloudScale;
    uniform float iCloudHeight;
    
    uniform float iFog;
    uniform float iHaze;
    uniform bool iCloudCheck;

    uniform bool iRGBE;
    
    varying vec3 worldPos;

    const vec2 iMouse = vec2(0.0);
    //	Simplex 3D Noise 
    //	by Ian McEwan, Ashima Arts
    //
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C 
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    // Permutations
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    // Gradients
    // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    vec3 skyColor( vec3 cameraRay, vec3 sunDirection, bool nosun ){
        vec3 skyColor = vec3( 1.0, 1.2, 1.7 );
      
        
        float sunHeight = (sunDirection.y + 1.0 ) * 0.5;
        float hozHeight = clamp(smoothstep(-0.2,1.0,sunHeight),0.0,1.0);
        
        float hozHeightAbs = clamp(smoothstep(0.2,1.0,sunHeight), 0.0,1.0)+0.01;
        float eyeHeight = clamp(( cameraRay.y ),0.0,0.2 ) ;
        
        vec3 sunColor = mix( vec3(3.0,0.0,0.0), vec3(0.95,0.95,0.7), hozHeightAbs );
        
        float sunDot = pow( ( dot( cameraRay, sunDirection ) + 1.0 ) * 0.5 , abs(500.0*pow(eyeHeight,1.0)+1.0));

        float skyDot = pow( ( dot( cameraRay, sunDirection ) + 1.0 ) * 0.5 , abs(5.0*eyeHeight+1.0) ) * (1.0 - clamp(sunDirection.y,0.0,1.0));

        skyColor=mix( skyColor, vec3(1.2,0.8,0.4)*2.0, skyDot );
        
        vec3 sunGlow = sunColor * sunDot * hozHeightAbs;
        
        vec3 skyGlow = skyColor * hozHeightAbs * (eyeHeight + 0.1);
        
        float stars = clamp(smoothstep(0.8,1.0,snoise(cameraRay*100.0)),0.0,1.0)*2.0 * clamp(smoothstep(0.1,0.5,cameraRay.y),0.0,1.0) * clamp(smoothstep(0.05,-0.2,sunDirection.y),0.0,1.0);
        
        float ground = pow(1.0-clamp(-cameraRay.y,0.0,1.0),20.0);
        
        float hazeAmount = 0.4;
        float haze = pow( 1.0 - abs(cameraRay.y), 5.0 )*(hozHeight+0.2)*iHaze;
        if(!nosun) sunGlow*=iHaze;
        vec3 col = skyGlow*0.8 + sunGlow * 0.9  + stars + haze*mix(sunColor,skyColor,0.5)*hazeAmount*hozHeight;
        
        vec3 groundColor = vec3(0.1,0.1,0.15) * clamp( sunDirection.y, 0.0,1.0 ) * sunColor * 2.0;
    
        if(cameraRay.y<0.0){
            col= mix(groundColor, col, ground); 
        }
        
        if(!nosun){
            float sun = clamp(smoothstep(0.9995,0.9996,dot( cameraRay, sunDirection )),0.0,1.0) * clamp(smoothstep(0.0,0.1,cameraRay.y),0.0,1.0)*4.0;
            col+=sun*sunColor;
        }
        
        return col;
    }

    float cloudValue( vec3 cloudCoord ){
        cloudCoord.y*=10.0*iCloudHeight + 1.0;
        cloudCoord = normalize(cloudCoord);
        cloudCoord *= iCloudScale*4.0;
        float time = iTime * 10.0;
        cloudCoord.z+=time;
        float cloud = snoise(cloudCoord)*0.55+snoise(cloudCoord*2.0+time*0.3)*0.2+snoise(cloudCoord*4.0+time*0.2)*0.2+snoise(cloudCoord*8.0+time*0.5)*0.05+snoise(cloudCoord*16.0)*0.05;
        cloud = ( cloud + 1.0 ) * 0.5;
        return cloud;
    }

    vec4 LinearToRGBE( in vec3 value ) {
        float maxComponent = max( max( value.r, value.g ), value.b );
        float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
        return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
    }

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        vec2 uv = (fragCoord/iResolution.xy - 0.5 ) * 2.0;
        
        vec2 mouse = ( iMouse.xy/iResolution.xy - 0.5 ) * 2.0;
        
        float aspect = iResolution.x/iResolution.y;

        vec3 sunDirection = iSunDirection;
        
        vec3 cameraRay = normalize(worldPos);
            
            
        vec3 col = skyColor( cameraRay, sunDirection, false );
        
        vec3 cloudCoord = cameraRay / (cameraRay.y + 0.2 );
        
        float cloud = cloudValue( cloudCoord );
        
        vec3 normal = vec3( cloudValue(cloudCoord + vec3(0.1,0.0,0.0)), cloudValue(cloudCoord + vec3(0.0,0.1,0.0)), cloudValue(cloudCoord + vec3(0.0,0.0,0.1))  );
        normal -= cloud;
        normalize(normal);
        normal.y = abs(normal.y);
                        
        
        vec3 cloudColor = vec3(cloud);
        
        float cloudCover = iCloudCover;
        float cloudThinkness = iCloudThickness * 0.75;
        float cloudAmbient = 1.0 - iCloudAmbient*0.8;
        
        vec3 sunColor = skyColor( sunDirection, sunDirection, true );
        float cloudmix = 1.0;
        if( cameraRay.y > 0.0 ){
            cloud = clamp(cloud-pow(1.0-abs(cameraRay.y),50.0)*0.5,0.0,1.0);
            float cloudLuma = clamp(sunDirection.y,0.0,1.0);
            float sunLighting = pow( dot( -normal, sunDirection ) + 1.0, abs((1.1 - cloudLuma) * (0.5+cloudAmbient*10.0)));
            vec3 cloudColor = clamp(sunLighting * sunColor * cloudLuma * (1.0-pow(cloudThinkness*1.0,2.0)) ,0.0,1.0);
            cloudmix = clamp(1.0-smoothstep(cloudCover*cloudThinkness,cloudCover,1.0-cloud),0.0,1.0);
            float trans = max(0.0,0.5-iCloudThickness);
            col = mix(col, cloudColor*(1.0-trans)+clamp(col,0.0,1.0)*trans,pow(cloudmix,abs((0.8 - cloudCover*0.5) * 2.0)));
        }

        float fogNoise = mix(cloudValue( cloudCoord+vec3(0.0,1.0,0.0) ),1.0,pow(1.0-abs(cameraRay.y),10.0));
        fogNoise = mix(0.0,fogNoise,clamp(smoothstep( -0.2,0.0,cameraRay.y),0.0,1.0));
        float fogAmount = pow(1.0-abs(cameraRay.y),3.0)*iFog*fogNoise;
        vec3 fogColor = mix(sunColor*0.5,sunColor*0.25,iCloudThickness)*(clamp(smoothstep(0.0,0.5,sunDirection.y),0.0,1.0)*0.9+0.15);

        col = mix(col,fogColor, fogAmount);
        
        col = pow(col,vec3(0.5));
        
        if(iRGBE) fragColor = LinearToRGBE(col);
            else fragColor = vec4(col,1.0);

        if(iCloudCheck) fragColor = vec4(vec3(cloudmix),1.0);
    }

    void main() {
        mainImage( gl_FragColor, gl_FragCoord.xy );
    }
`;
export default class Sky{
    constructor( renderer, scene ){
        this.renderer = renderer;

        this.canvas = document.createElement("canvas");
        this.canvas.width=1;
        this.canvas.height=1;
        this.ctx = this.canvas.getContext("2d");

        this.mainScene = scene;

        this.sunDirection = new THREE.Vector3;

        this.elevation = 0.65;
        this.direction = 0.33;
        this.cloudCover = 0.7;
        this.cloudThickness = 0.5;
        this.cloudAmbient = 0.75;
        this.cloudScale = 0.25;
        this.cloudHeight= 0.25;
        this.fog = 0.33;
        this.haze = 0.75;
        this.time = 0.0;


        var dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        dirLight.name = 'Sun Light';
        dirLight.position.copy( this.sunDirection ).multiplyScalar(100);
        dirLight.castShadow = true;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.left = - 20;
        dirLight.shadow.camera.top	= 20;
        dirLight.shadow.camera.bottom = - 20;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.radius = 3;
        dirLight.shadow.bias = -0.0005;
        scene.add( dirLight );
        this.sunLight = dirLight;
        
        this.scene = new THREE.Scene;

        this.camera = new THREE.OrthographicCamera( -0.1, 0.1, 0.1, -0.1, 0.1, 1000 );
        this.scene.add(this.camera);

        this.cubeCamera = new THREE.CubeCamera( 1, 100000, 1024 );
        this.scene.add( this.cubeCamera );    

        var geometry = new THREE.BoxGeometry();

        var uniforms = {
            iCloudCheck: { value: false },
            iTime: { value: this.time },
            iResolution:{ value: new THREE.Vector2(100,100) },
            iSunDirection:{value: this.sunDirection},
            iCloudCover:{value: this.cloudCover},
            iCloudThickness:{value: this.cloudThickness},
            iCloudAmbient:{value: this.cloudAmbient},
            iCloudScale:{value: this.cloudScale},
            iCloudHeight:{value: this.cloudHeight},
            iFog:{value: this.fog},
            iRGBE:{value: true},
            iHaze:{value: this.haze}
            
        };
        this.uniforms = uniforms;
        
        var material = new THREE.ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide,
            transparent: false
        } );


        var cube = new THREE.Mesh( geometry, material );
        cube.scale.set(100,100,100);
        this.scene.add( cube );

        this.pmremGenerator = new THREE.PMREMGenerator( renderer );
        this.pmremGenerator.compileCubemapShader();
        var target = this.pmremGenerator.fromScene( this.scene, 0, 0.1, 800 );
        this.updateSunDirection();


        window.setElevation=(a)=>{
            this.elevation = a;
            this.updateSunDirection();
        }
    }
    setElevation( elevation ){
        this.elevation = elevation;
        this.update();
    }
    setDirection( direction ){
        this.direction = direction;
        this.update();
    }
    setCloudCover( cover ){
        this.cloudCover = cover;
        this.uniforms.iCloudCover.value = cover;
        this.update();
    }
    setCloudAmbient( ambient ){
        this.cloudAmbient = ambient;
        this.uniforms.iCloudAmbient.value = ambient;
        this.update();
    }
    setCloudScale( scale ){
        this.cloudScale = scale;
        this.uniforms.iCloudScale.value = scale;
        this.update();
    }
    setCloudHeight( height ){
        this.cloudHeight = height;
        this.uniforms.iCloudHeight.value = height;
        this.update();
    }
    setTime( time ){
        this.time = time;
        this.uniforms.iTime.value = time;
        this.update();
    }
    setFog( fog ){
        this.fog = fog;
        this.uniforms.iFog.value = fog;
        this.update();
    }
    setHaze( haze ){
        this.haze = haze;
        this.uniforms.iHaze.value = haze;
        this.update();
    }
    
    setCloudThickness( thickness ){
        this.cloudThickness = thickness;
        this.uniforms.iCloudThickness.value = thickness;
        this.update();
    }
    getSunRender(){
        this.uniforms.iCloudCheck.value = true;
        this.camera.lookAt(this.sunDirection);
        var renderer = this.renderer;
        renderer.setClearColor(0xffffff, 0);
        renderer.setSize(1, 1);
        renderer.render( this.scene, this.camera );
        this.ctx.clearRect(0,0,1,1);
        this.ctx.drawImage(renderer.domElement,0,0);
        var imgData = this.ctx.getImageData(0,0,1,1);
        this.uniforms.iCloudCheck.value = false;
        return 1.0 - imgData.data[0]/255;
    }
    update(){
        if(!this.updateTimer){
            this.updateTimer = setTimeout(this.updateSunDirection.bind(this),50);
        }
    }
    updateSunDirection(){
        this.updateTimer = null;
        var elevationAngle = this.elevation*Math.PI;
        this.sunDirection.y = -Math.cos(elevationAngle);
        var directionAngle = this.direction*2*Math.PI
        this.sunDirection.x = Math.sin(directionAngle) * -Math.sin(elevationAngle);
        this.sunDirection.z = Math.cos(directionAngle) * -Math.sin(elevationAngle);
        this.sunLight.position.copy( this.sunDirection ).multiplyScalar(100);
        var target = this.pmremGenerator.fromScene( this.scene, 0, 0.1, 800 );
        this.mainScene.environment = target.texture;
        

        var lightIntensity = this.getSunRender();
        this.sunLight.intensity = lightIntensity * Math.pow(Math.max(0,this.sunDirection.y),0.2) * 0.75;
        this.sunLight.shadow.radius = (1.0-lightIntensity)*16+2.0;

        var lowColor = new THREE.Color(1,0,0);
        var highColor = new THREE.Color(0.95,0.95,0.92);

        var amount = Math.max(0,Math.pow(this.sunDirection.y,0.3));

        this.sunLight.color=lowColor.lerp(highColor,amount)

        this.uniforms.iRGBE.value = false;
        this.cubeCamera.update( this.renderer, this.scene );
        this.mainScene.background = this.cubeCamera.renderTarget;
        this.uniforms.iRGBE.value = true;
    }
}