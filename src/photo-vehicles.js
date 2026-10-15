// Five streamlined soapbox cars modeled after the supplied racing photographs.
// Local forward is -Z; the cockpit camera looks over the nose from (0,1.78,.28).

function paintedCanvas(THREE, kind) {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=512;
  const c=canvas.getContext('2d');
  const colors=['#f4d92b','#e7ece9','#bfc4c5','#ec5135','#eeeae2'];
  c.fillStyle=colors[kind];c.fillRect(0,0,1024,512);
  if(kind===0) {
    // Long burgundy and orange flames lick back from the pointed nose.
    for(const row of [40,462]) {
      c.fillStyle='#a72d33';c.beginPath();c.moveTo(95,row);
      c.bezierCurveTo(300,row-25,410,row-29,570,row-4);
      c.bezierCurveTo(675,row+24,760,row+3,928,row+8);
      c.bezierCurveTo(785,row+57,682,row+43,588,row+49);
      c.bezierCurveTo(420,row+74,245,row+17,95,row);c.fill();
      c.fillStyle='#f19e29';c.beginPath();c.moveTo(90,row+4);
      c.bezierCurveTo(265,row+3,400,row+8,580,row+24);
      c.bezierCurveTo(377,row+37,230,row+14,90,row+4);c.fill();
    }
  } else if(kind===1) {
    c.fillStyle='#2b708f';c.fillRect(0,0,375,512);
    c.fillStyle='#b72e35';c.fillRect(390,0,18,512);
    c.font='italic bold 44px Georgia';c.fillStyle='#a22c35';
    c.fillText('MISS GEORGIA MILK',415,260);
  } else if(kind===2) {
    c.strokeStyle='#242a2b';c.lineWidth=27;c.lineCap='round';
    for(let k=0;k<3;k++) {
      const y=178+k*76;
      c.beginPath();c.moveTo(82,y+13);c.bezierCurveTo(250,y-38,350,y-18,570,y-52);c.stroke();
    }
  } else if(kind===3) {
    c.fillStyle='#1e2528';
    for(let k=0;k<7;k++) {
      const x=95+k*125;
      c.beginPath();c.moveTo(x,0);c.lineTo(x+62,0);
      c.lineTo(x+193,512);c.lineTo(x+114,512);c.closePath();c.fill();
    }
  } else {
    c.fillStyle='#b6343c';c.fillRect(0,250,1024,30);
  }
  // Small scuffs keep the painted fiberglass from looking computer perfect.
  let seed=kind*111+37;
  for(let i=0;i<300;i++) {
    seed=(1664525*seed+1013904223)>>>0;const x=seed%1024;
    seed=(1664525*seed+1013904223)>>>0;const y=seed%512;
    c.fillStyle='rgba(65,54,44,.065)';c.fillRect(x,y,2+(seed%8),1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function textMaterial(THREE,words,color='#6c272c') {
  if(typeof document==='undefined')return new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle='#f4efdf';c.fillRect(0,0,512,128);
  c.fillStyle=color;c.font=`bold ${words.length>13?40:62}px Georgia,serif`;
  c.textAlign='center';c.textBaseline='middle';c.fillText(words,256,65);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});
}

export function createPhotoVehicle(THREE, variant, cockpit, stats) {
  const group=new THREE.Group();group.name=stats.name;
  const material=(color,metalness=0,roughness=.66)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
  const colors=[0xf4d92b,0xe7ece9,0xbfc4c5,0xec5135,0xeeeae2];
  const paint=material(colors[variant],.23,.48);
  const texture=paintedCanvas(THREE,variant);if(texture)paint.map=texture;
  const accent=material([0xa72d33,0x297997,0x242b2d,0x202528,0xc23a42][variant],.18,.5);
  const timber=material(0x8b6342),rubber=material(0x242628),iron=material(0x667071,.7,.52);
  const redWheel=material(0xa92a32,.3,.53),whiteWheel=material(0xf0eee4,.16,.57);
  const tanWheel=material(0xb79362,.06,.77),blackWheel=material(0x252a2b,.2,.5);
  const wheelMat=[tanWheel,redWheel,blackWheel,whiteWheel,blackWheel][variant];
  const add=(geometry,mat,x,y,z,parent=group)=>{
    const object=new THREE.Mesh(geometry,mat);object.position.set(x,y,z);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  };
  const box=(w,h,d,m,x,y,z,p)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
  const rod=(a,b,r,m,p=group)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const mesh=add(new THREE.CylinderGeometry(r,r,start.distanceTo(end),8),m,...start.clone().add(end).multiplyScalar(.5).toArray(),p);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return mesh;
  };
  const plate=(text,w,h,x,y,z,ry=0,color)=>{
    const object=add(new THREE.PlaneGeometry(w,h),textMaterial(THREE,text,color),x,y,z);
    object.rotation.y=ry;return object;
  };
  function discWheel(x,z,r) {
    const tire=add(new THREE.CylinderGeometry(r,r,.09,28),rubber,x,r,z);tire.rotation.z=Math.PI/2;
    const outer=add(new THREE.CylinderGeometry(r-.022,r-.022,.102,28),wheelMat,x,r,z);outer.rotation.z=Math.PI/2;
    const hub=add(new THREE.CylinderGeometry(.055,.055,.12,12),iron,x,r,z);hub.rotation.z=Math.PI/2;
    return outer;
  }
  function axle(z,halfWidth,r) {
    rod([-halfWidth,.44,z],[halfWidth,.44,z],.035,iron);
    for(const side of [-1,1]) discWheel(side*halfWidth,z,r);
  }
  function shell(zStart,zEnd,openTop=false) {
    const rings=16,around=32,positions=[],uv=[],indices=[];
    const a0=openTop?.70:0,a1=openTop?Math.PI*2-.70:Math.PI*2;
    for(let i=0;i<=rings;i++) {
      const t=i/rings,z=zStart+(zEnd-zStart)*t;
      let width,height;
      if(z < -1.72){const s=Math.max(.16,(z+2.12)/.4);width=.78*s;height=.48*s;}
      else if(z < -.7){width=.78;height=.48;}
      else {width=.78-(z+.7)*.12;height=.48-(z+.7)*.05;}
      for(let j=0;j<=around;j++) {
        const theta=a0+(a1-a0)*j/around;
        positions.push(Math.sin(theta)*width,.72+Math.cos(theta)*height,z);
        uv.push((z+2.12)/3.12,theta/(Math.PI*2));
        if(i&&j){const q=i*(around+1)+j;
          indices.push(q,q-1,q-around-1,q-1,q-around-2,q-around-1);}
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return add(geometry,paint,0,0,0);
  }
  function hoodRibbon(zStart,zEnd,thetaStart,thetaEnd,angularWidth,ribbonMaterial) {
    const positions=[],indices=[],steps=14;
    for(let i=0;i<=steps;i++) {
      const t=i/steps,z=zStart+(zEnd-zStart)*t;
      const width=z < -1.72 ? .78*Math.max(.16,(z+2.12)/.4) : .78;
      const height=z < -1.72 ? .48*Math.max(.16,(z+2.12)/.4) : .48;
      const angle=thetaStart+(thetaEnd-thetaStart)*t;
      const taper=Math.sin(Math.PI*Math.pow(t,.7))*.55+.28;
      for(const edge of [-1,1]) {
        const a=angle+edge*angularWidth*taper;
        positions.push(Math.sin(a)*(width+.015),.72+Math.cos(a)*(height+.015),z);
      }
      if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return add(geometry,ribbonMaterial,0,0,0);
  }
  function panel(corners,mat) {
    const points=corners.flat();
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
    return add(geometry,mat,0,0,0);
  }
  if(variant<4) {
    shell(-2.12,-.59,false);
    shell(-.59,.98,true);
    if(variant===0) {
      // Raised paint ribbons keep the forked flames legible from either flank.
      const ember=material(0xa62b32,.06,.7),orange=material(0xe58c2b,.05,.7);
      for(const side of [-1,1]) {
        hoodRibbon(-1.98,-.79,side*.54,side*.77,.20,ember);
        hoodRibbon(-1.73,-.67,side*1.07,side*.89,.13,ember);
        hoodRibbon(-1.91,-1.03,side*.48,side*.66,.075,orange);
      }
    }
    if(variant===2) {
      const charcoal=material(0x202427,.03,.75);
      for(const side of [-1,1]) {
        for(let stripe=0;stripe<3;stripe++) {
          const angle=side*(.19+stripe*.23);
          hoodRibbon(-1.97+stripe*.08,-.77+stripe*.045,angle,angle+side*.09,.057,charcoal);
        }
      }
    }
    // Black cockpit well and padded open seat; the shell never rises into the
    // first-person sightline.
    box(1.18,.10,1.00,material(0x303231),0,.48,.28);
    const seat=box(.88,.12,.54,material(0x5b4943),0,.62,.37);
    const back=box(.95,.56,.09,material(0x4f4641),0,.96,.78);back.rotation.x=-.13;
    for(const side of [-1,1]) {
      rod([side*.73,.50,-1.88],[side*1.22,.43,-1.62],.026,iron);
      rod([side*.72,.51,.64],[side*1.22,.43,.72],.026,iron);
    }
    axle(-1.65,1.22,variant===0?.44:.36);
    axle(.72,1.22,variant===0?.44:.36);
    if(variant===1) {
      // Tail fin and white shark-like mid-body identify the vintage plane car.
      const fin=box(.10,.48,.78,paint,0,1.17,.84);fin.rotation.x=.35;
      box(.13,.12,.42,accent,0,1.39,.87);
      for(const side of [-1,1]) {
        const wing=box(.68,.065,.62,paint,side*.91,.53,.77);
        wing.rotation.z=side*.10;
        plate('MISS GEORGIA',.96,.20,side*.78,.76,.05,side*Math.PI/2,'#9a2a33');
      }
    }
  } else {
    // The shuttle is intentionally boxy: flat white side walls, a sloped
    // windshield and two separate side nacelles, all above small rubber tires.
    box(1.74,.23,2.65,timber,0,.51,-.33);
    box(1.78,.15,2.56,paint,0,.64,-.34);
    for(const side of [-1,1]) {
      box(.09,.64,1.89,paint,side*.84,1.02,.05);
      box(.035,.10,2.03,accent,side*.89,.95,-.03);
      const nacelle=add(new THREE.CylinderGeometry(.17,.17,2.38,12),paint,side*1.02,.75,-.30);
      nacelle.rotation.x=Math.PI/2;
      const engine=add(new THREE.CylinderGeometry(.18,.18,.08,12),accent,side*1.02,.75,.89);
      engine.rotation.x=Math.PI/2;
      plate('NCC-1701',.78,.17,side*.90,1.11,.26,side*Math.PI/2,'#343738');
    }
    // Broad tapered shuttle prow, sloped down to a narrow leading edge.
    panel([[-.79,1.11,-.93],[.79,1.11,-.93],[.66,.68,-1.82],[-.66,.68,-1.82]],paint);
    panel([[-.84,.66,-.91],[-.79,1.11,-.93],[-.66,.68,-1.82],[-.68,.57,-1.82]],paint);
    panel([[.79,1.11,-.93],[.84,.66,-.91],[.68,.57,-1.82],[.66,.68,-1.82]],paint);
    box(1.34,.11,.11,paint,0,.64,-1.82);
    rod([-.63,.72,-1.75],[.63,.72,-1.75],.025,accent);
    // Five angled windshield panes form a frame around translucent glazing.
    const glass=new THREE.MeshStandardMaterial({color:0x7698a5,transparent:true,opacity:.23,roughness:.15,side:THREE.DoubleSide,depthWrite:false});
    panel([[-.76,1.13,-.92],[.76,1.13,-.92],[.72,1.54,-.60],[-.72,1.54,-.60]],glass);
    for(const x of [-.76,-.38,0,.38,.76]) rod([x,1.13,-.92],[x*.95,1.54,-.60],.025,iron);
    rod([-.73,1.54,-.60],[.73,1.54,-.60],.028,iron);
    box(1.57,.51,.08,paint,0,1.08,.87);
    box(1.17,.08,.59,material(0x524c47),0,.72,.37);
    for(const z of [-1.35,.68]) axle(z,1.02,.28);
    plate('U.S.S. ENTERPRISE',1.0,.15,0,1.03,-1.65,0,'#353a3c');
  }

  // Shared driver parts and animated controls match the rest of the garage.
  const wheel=new THREE.Group();wheel.position.set(0,1.12,-.35);group.add(wheel);
  rod([0,1.08,-.35],[0,.77,-.75],.032,iron);
  const steering=add(new THREE.TorusGeometry(.24,.032,8,24),rubber,0,0,0,wheel);steering.rotation.x=-.25;
  for(let k=0;k<3;k++) {
    const a=k*Math.PI*2/3;
    rod([0,0,0],[Math.cos(a)*.23,Math.sin(a)*.23,0],.018,iron,wheel);
  }
  const paddles=[];
  for(const side of [-1,1]) {
    const p=new THREE.Group();p.position.set(side*.41,.42,-.53);group.add(p);
    rod([0,0,0],[0,-.13,-.16],.022,iron,p);
    box(.18,.04,.21,timber,0,-.15,-.20,p);paddles.push(p);
  }
  const brake=new THREE.Group();brake.position.set(.15,.40,-.71);group.add(brake);
  rod([0,0,0],[0,-.12,-.12],.022,iron,brake);
  box(.17,.04,.16,rubber,0,-.14,-.15,brake);
  const gear=new THREE.Group();gear.position.set(.56,.58,-.34);group.add(gear);
  rod([0,0,0],[.03,.35,-.04],.02,iron,gear);
  add(new THREE.SphereGeometry(.07,10,8),accent,.03,.35,-.04,gear);
  for(const side of [-1,1]) {
    const lamp=add(new THREE.CylinderGeometry(.08,.08,.08,12),iron,side*.53,.86,-2.04);
    lamp.rotation.x=Math.PI/2;
    rod([side*.53,.69,-1.9],[side*.53,.85,-2.04],.018,iron);
  }
  const headlight=new THREE.SpotLight(0xffe8b4,0,32,Math.PI/9,.55,1.8);
  headlight.position.set(0,.93,-2.05);headlight.target.position.set(0,.3,-13);
  group.add(headlight,headlight.target);
  const flag=new THREE.Group();flag.position.set(.64,1.00,-1.42);group.add(flag);
  rod([0,0,0],[0,.68,0],.014,iron,flag);
  const cloth=add(new THREE.PlaneGeometry(.31,.22,4,2),accent,.16,.54,0,flag);
  flag.userData.cloth=cloth;
  group.userData={wheel,paddles,brake,gear,headlight,flag,stats};
  return group;
}
