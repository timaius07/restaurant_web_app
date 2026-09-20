import { 
  UtensilsCrossed, 
  Beef, 
  IceCream, 
  Soup, 
  Coffee, 
  Salad, 
  Coins, 
  Pizza, 
  Egg, 
  Drumstick, 
  Flame, 
  GlassWater, 
  BottleWine, 
  Package, 
  Utensils 
} from 'lucide-react';

/**
 * Returns the appropriate Lucide React Icon component for a given category name.
 * 
 * @param {string} catNombre - The category name string
 * @param {number} size - Icon size in px (default 20)
 * @param {string} className - Optional CSS class
 */
export function getCategoryIcon(catNombre, size = 20, className = '') {
  const name = (catNombre || '').toLowerCase().trim();

  if (name.includes('entrada')) return <UtensilsCrossed size={size} className={className} />;
  if (name.includes('plato fuerte') || name.includes('fuerte')) return <Beef size={size} className={className} />;
  if (name.includes('postre') || name.includes('dulce') || name.includes('helado')) return <IceCream size={size} className={className} />;
  if (name.includes('sopa') || name.includes('caldo')) return <Soup size={size} className={className} />;
  if (name.includes('bebida caliente') || name.includes('café') || name.includes('cafe')) return <Coffee size={size} className={className} />;
  if (name.includes('vegetariano') || name.includes('veggie') || name.includes('vegan')) return <Salad size={size} className={className} />;
  if (name.includes('económico') || name.includes('economico') || name.includes('barato')) return <Coins size={size} className={className} />;
  if (name.includes('rápida') || name.includes('rapida') || name.includes('fast food')) return <Pizza size={size} className={className} />;
  if (name.includes('desayuno')) return <Egg size={size} className={className} />;
  if (name.includes('almuerzo')) return <Drumstick size={size} className={className} />;
  if (name.includes('gallo') || name.includes('tortilla')) return <Flame size={size} className={className} />;
  if (name.includes('bebida natural') || name.includes('natural') || name.includes('fresco')) return <GlassWater size={size} className={className} />;
  if (name.includes('embotellado') || name.includes('gaseosa') || name.includes('soda')) return <BottleWine size={size} className={className} />;

  // General fallbacks
  if (name.includes('bebida')) return <GlassWater size={size} className={className} />;
  if (name.includes('plato') || name.includes('comida')) return <Utensils size={size} className={className} />;

  return <Package size={size} className={className} />;
}
