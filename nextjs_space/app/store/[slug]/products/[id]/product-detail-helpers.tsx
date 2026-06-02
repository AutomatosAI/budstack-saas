import { Leaf, Droplet, Package } from "lucide-react";

export const getStrainIcon = (type?: string) => {
  if (!type) return <Package className="w-6 h-6" />;
  switch (type.toLowerCase()) {
    case "indica":
      return <Leaf className="w-6 h-6" />;
    case "sativa":
      return <Droplet className="w-6 h-6" />;
    default:
      return <Package className="w-6 h-6" />;
  }
};

export const getStrainColor = (type?: string) => {
  if (!type)
    return {
      bg: "from-amber-500/20 to-orange-500/20",
      badge: "bg-amber-100 text-amber-900",
    };
  switch (type.toLowerCase()) {
    case "indica":
      return {
        bg: "from-purple-500/20 to-indigo-500/20",
        badge: "bg-purple-100 text-purple-900",
      };
    case "sativa":
      return {
        bg: "from-green-500/20 to-teal-500/20",
        badge: "bg-green-100 text-green-900",
      };
    default:
      return {
        bg: "from-amber-500/20 to-orange-500/20",
        badge: "bg-amber-100 text-amber-900",
      };
  }
};
