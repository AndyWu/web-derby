// Vehicle instances own their resources; collect shared mesh references once.
export function disposeVehicle(group) {
  if (!group) return;
  group.removeFromParent();
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      if (material) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
  });
  geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  textures.forEach((value) => value.dispose());
}
