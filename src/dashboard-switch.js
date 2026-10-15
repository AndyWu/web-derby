// A salvaged toggle and mounting board, attached to the player's actual car.
export function addDashboardSwitch(THREE, car) {
  const panel = new THREE.Group();
  panel.position.set(0.40, 1.30, -0.85);
  panel.rotation.x = -0.22;
  car.add(panel);
  const wood = new THREE.MeshStandardMaterial({ color:0x645039, roughness:0.95 });
  const metal = new THREE.MeshStandardMaterial({ color:0x96978a, metalness:0.8, roughness:0.4 });
  const black = new THREE.MeshStandardMaterial({ color:0x20241e, roughness:0.8 });
  const add=(geometry, material, x,y,z, parent=panel)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z); mesh.castShadow=true; parent.add(mesh); return mesh;
  };
  add(new THREE.BoxGeometry(0.44,0.32,0.07),wood,0,0,0);
  // Brackets connect the little dashboard to the chassis, including open carts.
  add(new THREE.BoxGeometry(0.035,0.44,0.04),metal,-0.16,-0.30,-0.03);
  add(new THREE.BoxGeometry(0.035,0.44,0.04),metal,0.16,-0.30,-0.03);
  const label=document.createElement('canvas'); label.width=512; label.height=384;
  const ctx=label.getContext('2d');
  ctx.fillStyle='#292d25'; ctx.fillRect(0,0,512,384);
  ctx.strokeStyle='#9d987b';ctx.lineWidth=5;ctx.strokeRect(10,10,492,364);
  ctx.fillStyle='#e8dfb7';ctx.textAlign='center';ctx.font='bold 58px monospace';ctx.fillText('HEADLIGHT',256,75);
  ctx.font='bold 35px monospace';ctx.fillText('ON',256,133);ctx.fillText('OFF',256,340);
  const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(0.39,0.28),new THREE.MeshStandardMaterial({map:texture,roughness:0.85}),0,0,0.036);
  for(const x of [-0.185,0.185])for(const y of [-0.125,0.125]){
    const screw=add(new THREE.CylinderGeometry(0.012,0.012,0.012,8),metal,x,y,0.043);
    screw.rotation.x=Math.PI/2;
    add(new THREE.BoxGeometry(0.015,0.002,0.002),black,x,y,0.05);
  }
  const nut=add(new THREE.CylinderGeometry(0.043,0.043,0.021,6),metal,0,-0.015,0.055);
  nut.rotation.x=Math.PI/2;
  const toggle=new THREE.Group(); toggle.position.set(0,-0.015,0.068);panel.add(toggle);
  const stem=add(new THREE.CylinderGeometry(0.013,0.013,0.105,10),metal,0,0,0.05,toggle);
  stem.rotation.x=Math.PI/2;
  add(new THREE.SphereGeometry(0.028,12,8),black,0,0,0.108,toggle);
  const indicatorMaterial=new THREE.MeshStandardMaterial({color:0x3f4632,emissive:0xffd777,emissiveIntensity:0,roughness:0.35});
  add(new THREE.SphereGeometry(0.015,10,8),indicatorMaterial,0.135,0.065,0.052);
  car.userData.lightSwitch={panel,toggle,indicatorMaterial};
  return panel;
}

export function updateDashboardSwitch(THREE, car, camera, button, on, width, height) {
  const control=car.userData.lightSwitch;
  if(!control)return;
  control.toggle.rotation.x=on ? -0.65 : 0.65;
  control.indicatorMaterial.emissiveIntensity=on ? 1.8 : 0;
  car.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const points=[[-0.22,-0.16],[0.22,0.16],[-0.22,0.16],[0.22,-0.16]].map(([x,y])=>control.panel.localToWorld(new THREE.Vector3(x,y,0.06)).project(camera));
  const xs=points.map(p=>(p.x+1)*width/2), ys=points.map(p=>(1-p.y)*height/2);
  const w=Math.max(44,Math.max(...xs)-Math.min(...xs));
  const h=Math.max(44,Math.max(...ys)-Math.min(...ys));
  button.style.left=`${(Math.max(...xs)+Math.min(...xs)-w)/2}px`;
  button.style.top=`${(Math.max(...ys)+Math.min(...ys)-h)/2}px`;
  button.style.width=`${w}px`;button.style.height=`${h}px`;
}
