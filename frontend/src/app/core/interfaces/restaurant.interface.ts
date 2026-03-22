export interface ITheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  darkMode?: boolean;
}

export interface IBillingConfig {
  vatPercentage: number;
  tipEnabled: boolean;
  tipPercentage?: number;
  tipDescription?: string;
  currency: string;
}

export interface ISocials {
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export interface IStation {
  name: string;
  lastPulse?: string | Date;
}

export interface ITotem {
  id: number;
  name: string;
  active: boolean;
  isVirtual?: boolean;
  lastOrderAt?: string | Date;
}

export interface IRestaurant {
  _id?: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo?: string;
  defaultLanguage: 'es' | 'en';
  theme: ITheme;
  billing: IBillingConfig;
  socials: ISocials;
  stations: IStation[];
  totems: ITotem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
