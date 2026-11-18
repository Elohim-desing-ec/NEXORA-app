/**
 * Catálogo de categorías: cada categoría principal engloba sus tipos de producto.
 * Ej.: «Ropa, calzado y textil» → camisetas, buzos, chalecos, gorras, calzado…
 * El producto guarda la categoría (la que agrupa en filtros y reportes) y, opcional, su tipo.
 * Ambos campos aceptan texto libre: si algo no está aquí, se escribe.
 */
export const CATALOGO: { categoria: string; tipos: string[] }[] = [
  { categoria: 'Ropa, calzado y textil', tipos: ['Camisetas', 'Camisas', 'Blusas', 'Polos', 'Buzos y sudaderas', 'Chompas y suéteres', 'Chaquetas y abrigos', 'Chalecos', 'Pantalones', 'Jeans', 'Shorts', 'Faldas', 'Vestidos', 'Conjuntos', 'Ropa deportiva', 'Ropa interior', 'Pijamas', 'Medias y calcetines', 'Trajes de baño', 'Uniformes', 'Ropa de bebé', 'Gorras y sombreros', 'Calzado', 'Bufandas y guantes', 'Cinturones', 'Telas e hilos'] },
  { categoria: 'Accesorios y joyería', tipos: ['Bolsos y carteras', 'Mochilas', 'Billeteras', 'Joyería y bisutería', 'Relojes', 'Gafas', 'Accesorios para el cabello'] },
  { categoria: 'Alimentos y bebidas', tipos: ['Abarrotes', 'Granos y cereales', 'Lácteos', 'Carnes y embutidos', 'Pescados y mariscos', 'Frutas y verduras', 'Panadería y pastelería', 'Bebidas', 'Bebidas alcohólicas', 'Snacks y golosinas', 'Enlatados', 'Congelados', 'Condimentos y salsas', 'Comida preparada'] },
  { categoria: 'Limpieza y hogar', tipos: ['Detergentes', 'Desinfectantes', 'Papel higiénico y servilletas', 'Desechables', 'Utensilios de cocina', 'Menaje', 'Decoración', 'Ropa de cama y toallas', 'Muebles'] },
  { categoria: 'Cuidado personal y belleza', tipos: ['Higiene personal', 'Cuidado del cabello', 'Cuidado de la piel', 'Maquillaje', 'Perfumes', 'Afeitado', 'Uñas'] },
  { categoria: 'Farmacia y salud', tipos: ['Medicamentos', 'Vitaminas y suplementos', 'Insumos médicos', 'Material de curación', 'Equipos médicos', 'Higiene y protección'] },
  { categoria: 'Tecnología', tipos: ['Celulares', 'Computadoras', 'Tablets', 'Accesorios', 'Audio', 'Televisores', 'Videojuegos', 'Componentes', 'Impresoras y tintas', 'Licencias y software'] },
  { categoria: 'Electrodomésticos', tipos: ['Cocina', 'Lavado', 'Refrigeración', 'Climatización', 'Pequeños electrodomésticos'] },
  { categoria: 'Papelería y oficina', tipos: ['Cuadernos', 'Útiles escolares', 'Papel', 'Escritura', 'Archivo', 'Mobiliario de oficina'] },
  { categoria: 'Ferretería y construcción', tipos: ['Herramientas', 'Eléctricos', 'Plomería', 'Pintura', 'Cemento y agregados', 'Acero y hierro', 'Madera', 'Acabados y pisos', 'Tornillería'] },
  { categoria: 'Repuestos y automotriz', tipos: ['Repuestos', 'Lubricantes', 'Llantas', 'Baterías', 'Accesorios para vehículos'] },
  { categoria: 'Juguetes y bebés', tipos: ['Juguetes', 'Juegos de mesa', 'Artículos para bebé', 'Pañales'] },
  { categoria: 'Deportes', tipos: ['Implementos deportivos', 'Bicicletas', 'Gimnasio', 'Camping'] },
  { categoria: 'Mascotas', tipos: ['Alimento para mascotas', 'Accesorios para mascotas', 'Higiene de mascotas'] },
  { categoria: 'Agro', tipos: ['Semillas', 'Fertilizantes', 'Agroquímicos', 'Alimento animal', 'Herramientas agrícolas', 'Cosecha'] },
  { categoria: 'Materia prima e insumos', tipos: ['Materia prima', 'Producto en proceso', 'Producto terminado', 'Empaques'] },
  { categoria: 'Otros', tipos: [] },
]

/** Tipos de una categoría (vacío si la categoría la escribió la empresa y no está en el catálogo). */
export const tiposDe = (categoria: string) => CATALOGO.find((c) => c.categoria.toLowerCase() === categoria.trim().toLowerCase())?.tipos ?? []
