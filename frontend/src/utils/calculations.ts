
import { Sale, Product, Stock } from '../types';

export const calculateProfit = (sale: Sale): number => {
  return (sale.sellingPrice - sale.purchasePrice) * sale.quantity;
};

export const getRemainingStock = (stocks: Stock[], productId: string): number => {
  const stock = stocks.find(s => s.productId === productId);
  return stock ? stock.remaining : 0;
};

export const isLowStock = (product: Product, stocks: Stock[]): boolean => {
  const stock = stocks.find(s => s.productId === product.id);
  if (!stock) return true;
  return stock.remaining <= product.minStock;
};
