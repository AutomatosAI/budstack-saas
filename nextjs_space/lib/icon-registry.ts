import {
  Activity, Award, BadgeCheck, Brain, Calendar, Check, CheckCircle, ClipboardList,
  Clock, Compass, CreditCard, Cross, Droplet, Eye, FileText, Flame, FlaskConical,
  Flower, Gift, Heart, HeartPulse, Info, Leaf, Lightbulb, Lock, Mail, MapPin,
  MessageCircle, MessageSquare, Microscope, Moon, Navigation, Package, Phone,
  Pill, Search, Settings, Shield, ShieldCheck, ShoppingBag, ShoppingCart,
  Sparkles, Star, Stethoscope, Sun, Syringe, Tag, Target, Thermometer, Timer,
  TreePine, TrendingUp, Trophy, Truck, User, UserCheck, Users, Zap,
  type LucideIcon,
} from 'lucide-react';

export const ICON_GROUPS = [
  {
    label: 'Health & Medical',
    icons: ['Stethoscope', 'Pill', 'HeartPulse', 'Activity', 'Brain', 'FlaskConical', 'Microscope', 'Syringe', 'Cross', 'Thermometer'],
  },
  {
    label: 'Cannabis & Nature',
    icons: ['Leaf', 'Flower', 'Droplet', 'Sun', 'Moon', 'TreePine', 'Flame'],
  },
  {
    label: 'Trust & Quality',
    icons: ['Shield', 'ShieldCheck', 'BadgeCheck', 'Award', 'Trophy', 'Star', 'Sparkles', 'Lock', 'CheckCircle', 'Check'],
  },
  {
    label: 'Commerce',
    icons: ['Package', 'Truck', 'ShoppingCart', 'ShoppingBag', 'CreditCard', 'Tag', 'Gift'],
  },
  {
    label: 'People & Comms',
    icons: ['User', 'Users', 'UserCheck', 'Mail', 'Phone', 'MessageSquare', 'MessageCircle'],
  },
  {
    label: 'Time & Location',
    icons: ['Clock', 'Calendar', 'Timer', 'MapPin', 'Compass', 'Navigation'],
  },
  {
    label: 'Action & Info',
    icons: ['Heart', 'Zap', 'Lightbulb', 'Target', 'TrendingUp', 'Eye', 'Search', 'Info', 'Settings', 'ClipboardList', 'FileText'],
  },
] as const;

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Activity, Award, BadgeCheck, Brain, Calendar, Check, CheckCircle, ClipboardList,
  Clock, Compass, CreditCard, Cross, Droplet, Eye, FileText, Flame, FlaskConical,
  Flower, Gift, Heart, HeartPulse, Info, Leaf, Lightbulb, Lock, Mail, MapPin,
  MessageCircle, MessageSquare, Microscope, Moon, Navigation, Package, Phone,
  Pill, Search, Settings, Shield, ShieldCheck, ShoppingBag, ShoppingCart,
  Sparkles, Star, Stethoscope, Sun, Syringe, Tag, Target, Thermometer, Timer,
  TreePine, TrendingUp, Trophy, Truck, User, UserCheck, Users, Zap,
};

const NORMALIZED_LOOKUP: Record<string, LucideIcon> = Object.fromEntries(
  Object.entries(ICON_COMPONENTS).map(([name, comp]) => [name.toLowerCase(), comp]),
);

/** Case-insensitive icon resolver. Returns the fallback (default: Sparkles) if the name is not found. */
export function getIcon(name: string | undefined | null, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!name) return fallback;
  const trimmed = String(name).trim();
  if (ICON_COMPONENTS[trimmed]) return ICON_COMPONENTS[trimmed];
  const normalized = NORMALIZED_LOOKUP[trimmed.toLowerCase()];
  return normalized ?? fallback;
}

/** Canonical (PascalCase) names in the order they appear in ICON_GROUPS. */
export const ICON_NAMES: string[] = ICON_GROUPS.flatMap((g) => [...g.icons]);
