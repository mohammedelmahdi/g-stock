import { useState, useMemo, useEffect, FormEvent, MouseEvent, Fragment } from 'react';
import { Product, Sale, SaleItem, SaleStatus, formatCurrency } from '../types';
import { 
  ShoppingCart, 
  History, 
  Plus, 
  Minus, 
  Check, 
  AlertTriangle, 
  Search, 
  Printer, 
  Calendar, 
  X,
  Trash2,
  AlertCircle,
  Edit2,
  Filter,
  MapPin,
  Truck,
  Copy,
  Eye,
  Package,
  Phone,
  Hash,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function TrackingCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 hover:border-indigo-500/50 px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-indigo-300 transition-all group">
      <Truck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      <span className="select-all tracking-wide text-slate-100">{code}</span>
      <button
        onClick={handleCopy}
        type="button"
        title="نسخ كود التتبع"
        className="p-1 hover:bg-indigo-500/30 rounded-lg transition-colors text-indigo-400 hover:text-indigo-200 cursor-pointer mr-0.5 flex items-center justify-center"
      >
        {copied ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-sans font-bold">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            تم النسخ!
          </span>
        ) : (
          <Copy className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}

const calculateSaleProfit = (sale: Sale): number => {
  let buyingCost = 0;
  if (sale.items && sale.items.length > 0) {
    buyingCost = sale.items.reduce((sum, item) => {
      const itemBuyingPrice = item.buyingPriceAtSale !== undefined ? item.buyingPriceAtSale : (sale.buyingPriceAtSale || 0);
      if (item.sellType === 'carton') {
        const cartonsQty = item.cartonsQuantity || 0;
        return sum + (cartonsQty * itemBuyingPrice);
      } else {
        const pairsQty = item.pairsQuantity || item.quantity || 0;
        return sum + (pairsQty * itemBuyingPrice);
      }
    }, 0);
  } else {
    buyingCost = (sale.buyingPriceAtSale || 0) * sale.quantity;
  }
  return sale.totalPrice - buyingCost;
};

interface SalesManagerProps {
  products: Product[];
  sales: Sale[];
  onAddSale: (sale: Omit<Sale, 'id' | 'date'>) => void;
  onDeleteSale: (saleId: string) => void;
  onViewReceipt: (sale: Sale) => void;
  onOpenReceiptModal: (sale: Sale) => void;
  onUpdateSaleStatus: (saleId: string, status: SaleStatus) => void;
  onUpdateSale: (sale: Sale) => void;
}

export default function SalesManager({ 
  products, 
  sales, 
  onAddSale, 
  onDeleteSale,
  onOpenReceiptModal,
  onUpdateSaleStatus,
  onUpdateSale
}: SalesManagerProps) {
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'new_sale' | 'history'>('new_sale');

  // Confirmation modal state for deleting sale
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Cart State for POS Caisse
  interface CartItem {
    product: Product;
    quantity: number; // cartons or pairs count
    sellType: 'carton' | 'pair';
    customPrice?: number; // Optional custom price per unit
  }

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saleError, setSaleError] = useState('');
  const [saleSuccess, setSaleSuccess] = useState(false);

  // Search History State
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyStateFilter, setHistoryStateFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('all');

  // Expanded Sale Cards for Inline Dropdown Items List
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  const toggleSaleExpand = (saleId: string) => {
    setExpandedSaleIds(prev => ({
      ...prev,
      [saleId]: !prev[saleId]
    }));
  };

  // Helper to get YYYY-MM-DD format in local timezone
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Extract all unique Wilayas from sales for the history filter
  const historyWilayas = useMemo(() => {
    const list = new Set<string>();
    sales.forEach(s => {
      if (s.customerState?.trim()) {
        list.add(s.customerState.trim());
      }
    });
    return Array.from(list).sort();
  }, [sales]);

  // Customer Information States for New Sale
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerState, setCustomerState] = useState(''); // الولاية
  const [customerMunicipality, setCustomerMunicipality] = useState(''); // البلدية
  const [customerColis, setCustomerColis] = useState(''); // عدد الكوليات / الطرود
  const [trackingCode, setTrackingCode] = useState(''); // كود تتبع التوصيل

  // Editing Sale States
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerState, setEditCustomerState] = useState('');
  const [editCustomerMunicipality, setEditCustomerMunicipality] = useState('');
  const [editCustomerColis, setEditCustomerColis] = useState<string>('');
  const [editTrackingCode, setEditTrackingCode] = useState<string>('');
  const [editTotalPrice, setEditTotalPrice] = useState<string>('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');

  const startEditingSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerName || '');
    setEditCustomerPhone(sale.customerPhone || '');
    setEditCustomerState(sale.customerState || '');
    setEditCustomerMunicipality(sale.customerMunicipality || '');
    setEditCustomerColis(sale.customerColis !== undefined ? String(sale.customerColis) : '1');
    setEditTrackingCode(sale.trackingCode || '');
    
    const initialItems = sale.items && sale.items.length > 0 
      ? [...sale.items] 
      : [{
          productId: sale.productId,
          productName: sale.productName,
          quantity: sale.quantity,
          buyingPriceAtSale: sale.buyingPriceAtSale,
          sellingPriceAtSale: sale.sellingPriceAtSale,
          totalPrice: sale.totalPrice,
          sellType: 'pair' as const,
          cartonsQuantity: 0,
          pairsQuantity: sale.quantity
        }];
    setEditItems(initialItems);
    setEditTotalPrice(String(sale.totalPrice));
    setEditProductSearch('');
  };

  const updateEditItemQty = (index: number, newQty: number) => {
    const updated = [...editItems];
    const item = updated[index];
    const product = products.find(p => p.id === item.productId);
    const pairsPerCtn = product?.pairsPerCarton || 12;

    if (item.sellType === 'carton') {
      item.cartonsQuantity = Math.max(1, newQty);
      item.quantity = item.cartonsQuantity * pairsPerCtn;
    } else {
      item.pairsQuantity = Math.max(1, newQty);
      item.quantity = item.pairsQuantity;
    }
    item.totalPrice = (item.sellType === 'carton' ? item.cartonsQuantity : item.pairsQuantity) * item.sellingPriceAtSale;
    setEditItems(updated);
  };

  const updateEditItemPrice = (index: number, newPrice: number) => {
    const updated = [...editItems];
    const item = updated[index];
    item.sellingPriceAtSale = Math.max(0, newPrice);
    item.totalPrice = (item.sellType === 'carton' ? item.cartonsQuantity : item.pairsQuantity) * item.sellingPriceAtSale;
    setEditItems(updated);
  };

  const updateEditItemSellType = (index: number, sellType: 'carton' | 'pair') => {
    const updated = [...editItems];
    const item = updated[index];
    const product = products.find(p => p.id === item.productId);
    const pairsPerCtn = product?.pairsPerCarton || 12;

    const fallbackSingleSelling = product?.singlePairSellingPrice || product?.sellingPrice || 0;
    const fallbackCartonSelling = product?.sellingPricePerCarton || (fallbackSingleSelling * pairsPerCtn);

    // Determine the historical base buying and selling prices from the item itself to avoid using current product price!
    let singleBuying = 0;
    let cartonBuying = 0;
    let singleSelling = 0;
    let cartonSelling = 0;
    
    if (item.sellType === 'carton' && sellType === 'pair') {
      cartonBuying = item.buyingPriceAtSale || 0;
      singleBuying = cartonBuying / pairsPerCtn;

      cartonSelling = item.sellingPriceAtSale || fallbackCartonSelling;
      singleSelling = cartonSelling / pairsPerCtn;
    } else if (item.sellType === 'pair' && sellType === 'carton') {
      singleBuying = item.buyingPriceAtSale || 0;
      cartonBuying = singleBuying * pairsPerCtn;

      singleSelling = item.sellingPriceAtSale || fallbackSingleSelling;
      cartonSelling = singleSelling * pairsPerCtn;
    } else {
      // Fallback if type didn't change or if it's newly loaded
      singleBuying = item.buyingPriceAtSale || product?.singlePairBuyingPrice || product?.buyingPrice || 0;
      cartonBuying = item.buyingPriceAtSale && item.sellType === 'carton' ? item.buyingPriceAtSale : (product?.buyingPricePerCarton || (singleBuying * pairsPerCtn));

      singleSelling = item.sellingPriceAtSale || fallbackSingleSelling;
      cartonSelling = item.sellingPriceAtSale && item.sellType === 'carton' ? item.sellingPriceAtSale : fallbackCartonSelling;
    }

    item.sellType = sellType;
    if (sellType === 'carton') {
      item.cartonsQuantity = 1;
      item.pairsQuantity = 0;
      item.quantity = pairsPerCtn;
      item.buyingPriceAtSale = cartonBuying;
      item.sellingPriceAtSale = cartonSelling;
      item.totalPrice = cartonSelling;
    } else {
      item.cartonsQuantity = 0;
      item.pairsQuantity = 1;
      item.quantity = 1;
      item.buyingPriceAtSale = singleBuying;
      item.sellingPriceAtSale = singleSelling;
      item.totalPrice = singleSelling;
    }
    setEditItems(updated);
  };

  const deleteEditItem = (index: number) => {
    const updated = editItems.filter((_, i) => i !== index);
    setEditItems(updated);
  };

  const addProductToEditItems = (product: Product) => {
    const alreadyIn = editItems.some(item => item.productId === product.id);
    if (alreadyIn) return;

    const pairsPerCtn = product.pairsPerCarton || 12;
    const singleBuying = product.singlePairBuyingPrice || product.buyingPrice;
    const singleSelling = product.singlePairSellingPrice || product.sellingPrice;
    const cartonBuying = product.buyingPricePerCarton || (singleBuying * pairsPerCtn);
    const cartonSelling = product.sellingPricePerCarton || (singleSelling * pairsPerCtn);

    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      quantity: pairsPerCtn,
      buyingPriceAtSale: cartonBuying,
      sellingPriceAtSale: cartonSelling,
      totalPrice: cartonSelling,
      sellType: 'carton',
      cartonsQuantity: 1,
      pairsQuantity: 0,
      sku: product.sku,
      imageUrl: product.imageUrl
    };

    setEditItems([...editItems, newItem]);
    setEditProductSearch('');
  };

  const computedEditTotalPrice = useMemo(() => {
    return editItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [editItems]);

  useEffect(() => {
    if (editingSale) {
      setEditTotalPrice(String(computedEditTotalPrice));
    }
  }, [computedEditTotalPrice, editingSale]);

  const editSearchableProducts = useMemo(() => {
    if (!editProductSearch.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(editProductSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(editProductSearch.toLowerCase())
    );
  }, [products, editProductSearch]);

  const handleSaveEditSale = (e: FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    if (editItems.length === 0) {
      alert("لا يمكن حفظ مبيعة بدون منتجات. يرجى إضافة منتج واحد على الأقل.");
      return;
    }

    let combinedName = '';
    if (editItems.length === 1) {
      combinedName = editItems[0].productName;
    } else {
      combinedName = `${editItems[0].productName} (+${editItems.length - 1} موديلات)`;
    }

    const totalPairs = editItems.reduce((sum, item) => sum + item.quantity, 0);
    const finalPrice = editTotalPrice ? Number(editTotalPrice) : computedEditTotalPrice;
    
    const totalCost = editItems.reduce((sum, item) => {
      const costPerUnit = item.buyingPriceAtSale || 0;
      if (item.sellType === 'carton') {
        return sum + ((item.cartonsQuantity || 0) * costPerUnit);
      } else {
        return sum + ((item.pairsQuantity || item.quantity || 0) * costPerUnit);
      }
    }, 0);

    const updated: Sale = {
      ...editingSale,
      productId: editItems[0].productId,
      productName: combinedName,
      quantity: totalPairs,
      totalPrice: finalPrice,
      buyingPriceAtSale: totalPairs > 0 ? (totalCost / totalPairs) : editingSale.buyingPriceAtSale,
      sellingPriceAtSale: totalPairs > 0 ? (finalPrice / totalPairs) : editingSale.sellingPriceAtSale,
      items: editItems,
      customerName: editCustomerName.trim(),
      customerPhone: editCustomerPhone.trim(),
      customerState: editCustomerState.trim(),
      customerMunicipality: editCustomerMunicipality.trim(),
      customerColis: editCustomerColis ? Number(editCustomerColis) : editingSale.customerColis,
      trackingCode: editTrackingCode.trim() || undefined
    };

    onUpdateSale(updated);
    setEditingSale(null);
  };

  // Filter products available for selling (quantity > 0 or searchable)
  const sellableProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                            p.sku.toLowerCase().includes(productSearch.toLowerCase());
      return matchesSearch && p.quantity > 0;
    });
  }, [products, productSearch]);

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    setSaleSuccess(false);
    setSaleError('');
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.product.id === product.id);
      
      // Default to carton always
      const defaultSellType: 'carton' | 'pair' = 'carton';
      
      if (existingIdx > -1) {
        const nextCart = [...prevCart];
        const currentItem = nextCart[existingIdx];
        const nextQty = currentItem.quantity + 1;
        
        // Stock Validation (Always carton)
        const maxCartons = product.cartonsCount !== undefined ? product.cartonsCount : Math.floor(product.quantity / (product.pairsPerCarton || 12));
        if (nextQty > maxCartons) {
          setSaleError(`المخزون غير كافٍ لـ "${product.name}". الحد الأقصى المتاح: ${maxCartons} كرتون`);
          return prevCart;
        }
        
        nextCart[existingIdx] = {
          ...currentItem,
          quantity: nextQty
        };
        return nextCart;
      } else {
        // Stock Validation for first item
        const maxCartons = product.cartonsCount !== undefined ? product.cartonsCount : Math.floor(product.quantity / (product.pairsPerCarton || 12));
        if (maxCartons <= 0) {
          setSaleError(`لا يتوفر أي كرتون في المخزن لـ "${product.name}".`);
          return prevCart;
        }
        return [...prevCart, { product, quantity: 1, sellType: defaultSellType }];
      }
    });
  };

  // Update cart quantities
  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    setSaleError('');
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return item;
          
          const freshProduct = products.find(p => p.id === productId) || item.product;
          
          if (item.sellType === 'carton') {
            const maxCartons = freshProduct.cartonsCount !== undefined ? freshProduct.cartonsCount : Math.floor(freshProduct.quantity / (freshProduct.pairsPerCarton || 12));
            if (nextQty > maxCartons) {
              setSaleError(`المخزون غير كافٍ لـ "${item.product.name}". الحد الأقصى المتاح: ${maxCartons} كرتون`);
              return item;
            }
          } else {
            if (nextQty > freshProduct.quantity) {
              setSaleError(`المخزون غير كافٍ لـ "${item.product.name}". الحد الأقصى المتاح: ${freshProduct.quantity} زوج`);
              return item;
            }
          }
          
          return { ...item, quantity: nextQty };
        }
        return item;
      });
    });
  };

  // Update cart sell type (carton vs pair)
  const handleUpdateCartSellType = (productId: string, sellType: 'carton' | 'pair') => {
    setSaleError('');
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const freshProduct = products.find(p => p.id === productId) || item.product;
          
          if (sellType === 'carton') {
            const maxCartons = freshProduct.cartonsCount !== undefined ? freshProduct.cartonsCount : Math.floor(freshProduct.quantity / (freshProduct.pairsPerCarton || 12));
            if (maxCartons === 0) {
              setSaleError(`لا توجد كراتين كافية لـ "${item.product.name}". تم البيع بالزوج فقط.`);
              return item;
            }
          }
          
          // Reset to 1 and clear custom price to avoid incorrect pricing
          return { ...item, sellType, quantity: 1, customPrice: undefined };
        }
        return item;
      });
    });
  };

  // Update cart item price
  const handleUpdateCartPrice = (productId: string, price: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          return {
            ...item,
            customPrice: isNaN(price) || price < 0 ? undefined : price
          };
        }
        return item;
      });
    });
  };

  // Remove item from cart
  const handleRemoveFromCart = (productId: string) => {
    setSaleError('');
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  // Validate and submit multi-item sale
  const handleValidateSale = (e: FormEvent) => {
    e.preventDefault();
    setSaleError('');
    setSaleSuccess(false);

    if (cart.length === 0) {
      return setSaleError('يرجى إضافة سلع إلى السلة أولاً.');
    }

    // Validate customer details
    if (!customerName.trim() || !customerPhone.trim() || !customerState.trim() || !customerMunicipality.trim()) {
      return setSaleError('يرجى ملء جميع معلومات الزبون: الاسم، رقم الهاتف، الولاية، والبلدية.');
    }

    // Validate Algerian phone number (must be 10 digits starting with 05, 06, or 07, or +213 format)
    const cleanedPhone = customerPhone.trim().replace(/[\s-]/g, '');
    const phoneRegex = /^(0|\+213)(5|6|7)\d{8}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      return setSaleError('رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف جزائري صالح يتكون من 10 أرقام ويبدأ بـ 05 أو 06 أو 07.');
    }

    // Check stock
    for (const item of cart) {
      const freshProduct = products.find(p => p.id === item.product.id);
      if (!freshProduct) {
        return setSaleError(`المنتج "${item.product.name}" لم يعد متوفراً في النظام.`);
      }
      
      if (item.sellType === 'carton') {
        const neededPairs = item.quantity * (freshProduct.pairsPerCarton || 12);
        if (neededPairs > freshProduct.quantity) {
          return setSaleError(`الكمية المطلوبة من "${item.product.name}" (${item.quantity} كرتون = ${neededPairs} زوج) تتجاوز المتوفر بالمخزن (${freshProduct.quantity} زوج).`);
        }
      } else {
        if (item.quantity > freshProduct.quantity) {
          return setSaleError(`الكمية المطلوبة من "${item.product.name}" (${item.quantity} زوج) تتجاوز المتوفر بالمخزن (${freshProduct.quantity} زوج).`);
        }
      }
    }

    let totalAmount = 0;
    let totalPairs = 0;
    let totalCost = 0;

    const saleItems = cart.map(item => {
      const freshProduct = products.find(p => p.id === item.product.id)!;
      const pairsPerCtn = freshProduct.pairsPerCarton || 12;
      
      const singleBuying = freshProduct.singlePairBuyingPrice || freshProduct.buyingPrice;
      const singleSelling = freshProduct.singlePairSellingPrice || freshProduct.sellingPrice;
      
      const cartonBuying = freshProduct.buyingPricePerCarton || (singleBuying * pairsPerCtn);
      const cartonSelling = freshProduct.sellingPricePerCarton || (singleSelling * pairsPerCtn);

      let itemTotalPrice = 0;
      let itemTotalPairs = 0;
      let itemTotalCost = 0;

      const sellingPriceUsed = item.sellType === 'carton'
        ? (item.customPrice !== undefined ? (item.customPrice * pairsPerCtn) : cartonSelling)
        : (item.customPrice !== undefined ? item.customPrice : singleSelling);

      if (item.sellType === 'carton') {
        itemTotalPrice = item.quantity * sellingPriceUsed;
        itemTotalPairs = item.quantity * pairsPerCtn;
        itemTotalCost = item.quantity * cartonBuying;
      } else {
        itemTotalPrice = item.quantity * sellingPriceUsed;
        itemTotalPairs = item.quantity;
        itemTotalCost = item.quantity * singleBuying;
      }

      totalAmount += itemTotalPrice;
      totalPairs += itemTotalPairs;
      totalCost += itemTotalCost;

      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity: itemTotalPairs, // total pairs sold
        buyingPriceAtSale: item.sellType === 'carton' ? cartonBuying : singleBuying,
        sellingPriceAtSale: sellingPriceUsed,
        totalPrice: itemTotalPrice,
        
        // Wholesale details
        sellType: item.sellType,
        cartonsQuantity: item.sellType === 'carton' ? item.quantity : 0,
        pairsQuantity: item.sellType === 'pair' ? item.quantity : 0,
        sku: freshProduct.sku,
        imageUrl: freshProduct.imageUrl
      };
    });

    // Concatenate names or summary
    let combinedName = '';
    if (cart.length === 1) {
      combinedName = cart[0].product.name;
    } else {
      combinedName = `${cart[0].product.name} (+${cart.length - 1} موديلات)`;
    }

    // Calculate colis/parcels count
    const totalCartonsInCart = cart.reduce((sum, item) => sum + (item.sellType === 'carton' ? item.quantity : 0), 0);
    let finalColis = totalCartonsInCart;
    if (customerColis.trim() !== '') {
      const parsed = parseInt(customerColis, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        finalColis = parsed;
      }
    }

    onAddSale({
      productId: cart[0].product.id, // For backwards compatibility
      productName: combinedName,
      quantity: totalPairs,
      totalPrice: totalAmount,
      buyingPriceAtSale: totalCost / totalPairs, // Average buying price per pair for dashboard compatibility
      sellingPriceAtSale: totalAmount / totalPairs, // Average selling price per pair
      items: saleItems,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerState: customerState.trim(),
      customerMunicipality: customerMunicipality.trim(),
      customerColis: finalColis,
      trackingCode: trackingCode.trim() || undefined
    });

    // Reset state & show success trigger
    setSaleSuccess(true);
    setCart([]);
    setProductSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerState('');
    setCustomerMunicipality('');
    setCustomerColis('');
    setTrackingCode('');
    
    setTimeout(() => {
      setSaleSuccess(false);
    }, 4000);
  };

  // 5. Filter Sales History list
  const filteredSalesHistory = useMemo(() => {
    let list = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Status Filter
    if (historyStatusFilter !== 'all') {
      list = list.filter(s => (s.status || 'pending') === historyStatusFilter);
    }

    // State (Wilaya) Filter
    if (historyStateFilter !== 'all') {
      list = list.filter(s => s.customerState?.trim() === historyStateFilter.trim());
    }

    // Date Filter
    if (historyDateFilter !== 'all') {
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);

      list = list.filter(s => {
        const saleDateStr = s.date.split('T')[0];
        if (historyDateFilter === 'today') {
          return saleDateStr === todayStr;
        } else if (historyDateFilter === 'yesterday') {
          return saleDateStr === yesterdayStr;
        } else if (historyDateFilter === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);
          return saleDateStr >= sevenDaysAgoStr && saleDateStr <= todayStr;
        } else if (historyDateFilter === 'month') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo);
          return saleDateStr >= thirtyDaysAgoStr && saleDateStr <= todayStr;
        }
        return true;
      });
    }

    // Text Search
    if (historySearch.trim()) {
      const searchLower = historySearch.toLowerCase().trim();
      list = list.filter(s => 
        s.productName.toLowerCase().includes(searchLower) || 
        s.id.toLowerCase().includes(searchLower) ||
        s.customerName?.toLowerCase().includes(searchLower) ||
        s.customerPhone?.toLowerCase().includes(searchLower) ||
        s.trackingCode?.toLowerCase().includes(searchLower)
      );
    }
    
    return list;
  }, [sales, historySearch, historyStatusFilter, historyStateFilter, historyDateFilter]);

  return (
    <div id="sales-section" className="space-y-6 text-right" dir="rtl">
      
      {/* Sales Navigation Tabs */}
      <div className="flex border-b border-slate-800">
        <button 
          id="tab-new-sale"
          onClick={() => { setActiveTab('new_sale'); setSaleError(''); }}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all h-14 cursor-pointer ${
            activeTab === 'new_sale' 
              ? 'border-indigo-500 text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-indigo-400" />
          <span>بيع جديد (الصندوق)</span>
        </button>
        <button 
          id="tab-sales-history"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all h-14 cursor-pointer ${
            activeTab === 'history' 
              ? 'border-indigo-500 text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4 text-indigo-400" />
          <span>سجل المبيعات</span>
        </button>
      </div>

      {/* POS Caisse Interface Panel */}
      {activeTab === 'new_sale' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Product Search & Selector (7 columns) */}
          <div className="lg:col-span-7 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4 text-right">
            <h3 className="text-lg font-bold text-slate-100">1. البحث واختيار السلعة / المنتج</h3>
            
            {/* Search Input inside POS */}
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="امسح الباركود أو ابحث عن طريق الاسم أو رمز SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm rounded-xl h-12 text-slate-200 placeholder-slate-500 text-right"
              />
              {productSearch && (
                <button 
                  onClick={() => setProductSearch('')}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Product list grid with instant click triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pl-1 text-right">
              {sellableProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                  {products.length === 0 ? (
                    <p className="text-sm font-semibold">المخزن فارغ. يرجى إضافة منتجات في المخزون أولاً.</p>
                  ) : (
                    <p className="text-sm font-semibold">لا تتوفر أي منتجات مطابقة للبحث.</p>
                  )}
                </div>
              ) : (
                sellableProducts.map((p) => {
                  const cartItem = cart.find(item => item.product.id === p.id);
                  const inCartCount = cartItem ? cartItem.quantity : 0;
                  const cartons = p.cartonsCount !== undefined ? p.cartonsCount : Math.floor(p.quantity / (p.pairsPerCarton || 12));
                  const isLow = cartons < 3;
                  const shoeImg = p.imageUrl || '👟';
                  const isUrlImage = shoeImg.startsWith('http') || shoeImg.startsWith('data:');
                  
                  const pSingleSelling = p.singlePairSellingPrice || p.sellingPrice;
                  const pCartonSelling = p.sellingPricePerCarton || (pSingleSelling * (p.pairsPerCarton || 12));

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className={`text-right p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer h-24 ${
                        inCartCount > 0 
                          ? 'border-indigo-500 bg-indigo-500/5 shadow-lg scale-[1.01]' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/25 hover:bg-slate-950/50'
                      }`}
                    >
                      {/* Shoe Image Box */}
                      <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden text-xl shadow-inner">
                        {isUrlImage ? (
                          <img src={shoeImg} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{shoeImg}</span>
                        )}
                      </div>

                      <div className="min-w-0 text-right flex-1 flex flex-col justify-between h-full py-0.5">
                        <div>
                          <div className="flex items-center justify-between gap-1" dir="rtl">
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md">
                              {p.sku}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isLow ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {cartons} كرتون
                            </span>
                          </div>
                          <h4 className="text-xs font-extrabold text-slate-200 leading-tight truncate mt-1">{p.name}</h4>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-slate-800/60 pt-1 text-[11px]" dir="rtl">
                          <span className="text-slate-400">الكرتون: <strong className="text-slate-100">{formatCurrency(pCartonSelling)}</strong></span>
                          {inCartCount > 0 && (
                            <span className="px-2 py-0.5 bg-indigo-600 rounded-full text-white text-[9px] font-bold">
                              {cartItem?.sellType === 'carton' ? `${inCartCount} كرتون` : `${inCartCount} زوج`}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* POS Cart Summary (5 columns) */}
          <div className="lg:col-span-5 space-y-4 text-right">
            
            {/* Feedback messages */}
            {saleSuccess && (
              <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-2xl border border-emerald-500/20 flex items-center gap-2.5 shadow-xl animate-pulse text-right" dir="rtl">
                <Check className="w-5 h-5 bg-emerald-600 text-white rounded-full p-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">تم تسجيل عملية البيع!</p>
                  <p className="text-xs text-emerald-400/90">تم تحديث كمية المخزون وسجل المبيعات وقالب قوقل شيت بنجاح.</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-100">2. سلة المبيعات ({cart.length} سلع)</h3>
                {cart.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => { setCart([]); setSaleError(''); }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    تفريغ السلة
                  </button>
                )}
              </div>

              {saleError && (
                <div className="p-3 bg-rose-500/10 text-rose-400 text-xs font-semibold rounded-xl border border-rose-500/20 flex items-center gap-2" dir="rtl">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <span>{saleError}</span>
                </div>
              )}

              {cart.length > 0 ? (
                <form onSubmit={handleValidateSale} className="space-y-6">
                  
                  {/* Cart list items layout */}
                  <div className="space-y-4 max-h-[340px] overflow-y-auto pl-1">
                    {cart.map((item) => {
                      const pairsPerCarton = item.product.pairsPerCarton || 12;
                      const pSingleSelling = item.product.singlePairSellingPrice || item.product.sellingPrice;
                      const pCartonSelling = item.product.sellingPricePerCarton || (pSingleSelling * pairsPerCarton);
                      
                      const unitPrice = item.sellType === 'carton'
                        ? (item.customPrice !== undefined ? (item.customPrice * pairsPerCarton) : pCartonSelling)
                        : (item.customPrice !== undefined ? item.customPrice : pSingleSelling);
                      const lineTotal = unitPrice * item.quantity;
                      
                      const shoeImg = item.product.imageUrl || '👟';
                      const isUrlImage = shoeImg.startsWith('http') || shoeImg.startsWith('data:');

                      return (
                        <div key={item.product.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-3 text-right">
                          <div className="flex items-start gap-2.5">
                            {/* Product mini icon */}
                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden text-lg shadow-inner">
                              {isUrlImage ? (
                                <img src={shoeImg} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span>{shoeImg}</span>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono bg-indigo-500/5 px-1.5 py-0.5 rounded-md">
                                  {item.product.sku}
                                </span>
                              </div>
                              <h4 className="text-xs font-extrabold text-slate-100 mt-1 leading-tight truncate">{item.product.name}</h4>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.product.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Dynamic Custom Selling Price Input */}
                          <div className="flex flex-col gap-1.5 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60 mt-0.5" dir="rtl">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold shrink-0">تعديل سعر الحذاء (الزوج):</span>
                              <div className="flex items-center gap-1.5">
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={item.customPrice !== undefined ? item.customPrice : pSingleSelling}
                                    onChange={(e) => handleUpdateCartPrice(item.product.id, parseFloat(e.target.value))}
                                    placeholder={String(pSingleSelling)}
                                    className="w-24 bg-slate-950 text-slate-100 font-extrabold text-xs px-2 py-1 rounded-lg border border-slate-800 text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="absolute left-1.5 top-1 text-[9px] text-slate-500 font-bold">د.ج</span>
                                </div>
                                {item.customPrice !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartPrice(item.product.id, NaN)}
                                    className="text-[9px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
                                    title="إعادة السعر الافتراضي"
                                  >
                                    افتراضي
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Calculated Carton Price */}
                            <div className="flex items-center justify-between text-[10px] border-t border-slate-900/60 pt-1 text-slate-400">
                              <span>سعر الكرتون المحتسب ({pairsPerCarton} أزواج):</span>
                              <span className="font-extrabold text-indigo-400 font-mono">
                                {formatCurrency(unitPrice)}
                              </span>
                            </div>
                          </div>

                          {/* Segmented Control & Qty Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-900 pt-2.5" dir="rtl">
                            
                            {/* Sell Type Indicator (Carton only) */}
                            <div className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/10 w-full sm:w-auto text-center shrink-0">
                              بيع بالكرتون (جملة)
                            </div>

                            {/* Quantity control */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                              <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(item.product.id, -1)}
                                  disabled={item.quantity <= 1}
                                  className="w-6 h-6 flex items-center justify-center bg-slate-950 hover:bg-slate-800 disabled:opacity-40 rounded-md text-slate-200 transition-colors cursor-pointer text-xs"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-8 text-center font-extrabold text-xs text-slate-100">
                                  {item.quantity} {item.sellType === 'carton' ? 'كرتون' : 'زوج'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(item.product.id, 1)}
                                  className="w-6 h-6 flex items-center justify-center bg-slate-950 hover:bg-slate-800 disabled:opacity-40 rounded-md text-slate-200 transition-colors cursor-pointer text-xs"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <span className="text-xs font-bold text-slate-200 text-left shrink-0">
                                {formatCurrency(lineTotal)}
                              </span>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Customer Information Form Section */}
                  <div className="space-y-3 pt-4 border-t border-slate-800 text-right" dir="rtl">
                    <h4 className="text-xs font-bold text-indigo-400 tracking-wider">3. معلومات الزبون (إجباري)</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">اسم الزبون الكامل *</label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="مثال: أحمد محمد"
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right h-10"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">رقم الهاتف *</label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="مثال: 0555123456"
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right h-10"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">الولاية *</label>
                        <input
                          type="text"
                          required
                          value={customerState}
                          onChange={(e) => setCustomerState(e.target.value)}
                          placeholder="مثال: وهران"
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right h-10"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">البلدية *</label>
                        <input
                          type="text"
                          required
                          value={customerMunicipality}
                          onChange={(e) => setCustomerMunicipality(e.target.value)}
                          placeholder="مثال: بئر الجير"
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right h-10"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">عدد الكوليات (الطرود) - اختياري</label>
                        <input
                          type="number"
                          min="0"
                          value={customerColis}
                          onChange={(e) => setCustomerColis(e.target.value)}
                          placeholder={`تلقائي: ${cart.reduce((sum, item) => sum + (item.sellType === 'carton' ? item.quantity : 0), 0)} طرد`}
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right h-10"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-indigo-400 font-bold mb-1 flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          <span>كود تتبع التوصيل (Tracking Code) - اختياري</span>
                        </label>
                        <input
                          type="text"
                          value={trackingCode}
                          onChange={(e) => setTrackingCode(e.target.value)}
                          placeholder="مثال: YAL-12345678"
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-700 text-right font-mono h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing recap details */}
                  <div className="space-y-3 pt-4 border-t border-slate-800 text-right">
                    <div className="flex justify-between text-xs text-slate-400" dir="rtl">
                      <span>المجموع الفرعي</span>
                      <span>
                        {formatCurrency(cart.reduce((sum, item) => {
                          const pairsPerCarton = item.product.pairsPerCarton || 12;
                          const pSingle = item.product.singlePairSellingPrice || item.product.sellingPrice;
                          const pCarton = item.product.sellingPricePerCarton || (pSingle * pairsPerCarton);
                          const price = item.sellType === 'carton'
                            ? (item.customPrice !== undefined ? (item.customPrice * pairsPerCarton) : pCarton)
                            : (item.customPrice !== undefined ? item.customPrice : pSingle);
                          return sum + (price * item.quantity);
                        }, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-slate-100 pt-2 border-t border-slate-800 border-dashed" dir="rtl">
                      <span>الإجمالي الصافي للبيع</span>
                      <span className="text-lg text-indigo-400 font-extrabold">
                        {formatCurrency(cart.reduce((sum, item) => {
                          const pairsPerCarton = item.product.pairsPerCarton || 12;
                          const pSingle = item.product.singlePairSellingPrice || item.product.sellingPrice;
                          const pCarton = item.product.sellingPricePerCarton || (pSingle * pairsPerCarton);
                          const price = item.sellType === 'carton'
                            ? (item.customPrice !== undefined ? (item.customPrice * pairsPerCarton) : pCarton)
                            : (item.customPrice !== undefined ? item.customPrice : pSingle);
                          return sum + (price * item.quantity);
                        }, 0))}
                      </span>
                    </div>
                  </div>

                  {/* Submit sale */}
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition duration-200 shadow-lg shadow-emerald-900/20 h-12 cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                    تأكيد وتسجيل عملية البيع
                  </button>

                </form>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-3 bg-slate-950 rounded-2xl border border-slate-800/60 text-center">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-full">
                    <ShoppingCart className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400">سلة المبيعات فارغة</p>
                  <p className="text-xs max-w-[200px]">اضغط على المنتجات المتوفرة في القائمة اليمنى لإضافتها إلى السلة والبدء بالبيع.</p>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* Historical Sales Log */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          
          {/* History Filters & Search */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="ابحث بالمنتج، اسم الزبون، الهاتف، المعرف، أو كود التتبع..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm rounded-xl h-12 text-slate-200 placeholder-slate-500 text-right font-sans"
                />
                {historySearch && (
                  <button 
                    onClick={() => setHistorySearch('')}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              
              {/* Status Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-400" />
                  <span>تصفية بحالة الطلبية:</span>
                </label>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2.5 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 h-10 text-right cursor-pointer"
                >
                  <option value="all">كل الحالات (جميع الطلبات)</option>
                  <option value="pending">قيد الانتظار ⏳</option>
                  <option value="shipped">تم الشحن 🚚</option>
                  <option value="delivered">تم التوصيل ✅</option>
                  <option value="returned">مسترجع ↩️</option>
                  <option value="returned_to_supplier">معاد للمورد 🔄</option>
                </select>
              </div>

              {/* State / Wilaya Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-400" />
                  <span>تصفية بحسب الولاية:</span>
                </label>
                <select
                  value={historyStateFilter}
                  onChange={(e) => setHistoryStateFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2.5 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 h-10 text-right cursor-pointer"
                >
                  <option value="all">كل الولايات الجزائرية</option>
                  {historyWilayas.map((wilaya) => (
                    <option key={wilaya} value={wilaya}>{wilaya}</option>
                  ))}
                </select>
              </div>

              {/* Date Preset Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-400" />
                  <span>تصفية بالفترة الزمنية:</span>
                </label>
                <select
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2.5 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 h-10 text-right cursor-pointer"
                >
                  <option value="all">كل الأوقات</option>
                  <option value="today">اليوم</option>
                  <option value="yesterday">البارحة</option>
                  <option value="week">آخر 7 أيام</option>
                  <option value="month">آخر 30 يوم</option>
                </select>
              </div>

            </div>
          </div>

          {/* Table / Cards list for sales logs */}
          {filteredSalesHistory.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center flex flex-col items-center justify-center shadow-xl">
              <div className="p-4 bg-slate-950 border border-slate-800 text-slate-500 rounded-full mb-4">
                <History className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-300">لا توجد مبيعات مطابقة</p>
              <p className="text-xs text-slate-500 mt-1">لم تقم بإجراء أي عمليات بيع تطابق عملية البحث هذه بعد.</p>
            </div>
          ) : (
            <>
              {/* Mobile View list */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredSalesHistory.map((sale) => (
                  <div 
                    key={sale.id} 
                    className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3 text-right transition-all"
                  >
                    <div className="flex items-start justify-between" dir="rtl">
                      <div className="text-right">
                        <p className="text-[10px] font-bold font-mono text-slate-500 uppercase">المعرف: {sale.id.slice(0, 8)}</p>
                        <h4 className="text-sm font-bold text-slate-200 mt-0.5">{sale.productName}</h4>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="text-sm font-extrabold text-emerald-400 block">
                          {formatCurrency(sale.totalPrice)}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-300 block mt-0.5">
                          الفائدة: {formatCurrency(calculateSaleProfit(sale))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80" dir="rtl">
                      <span>الكمية: <strong>{sale.quantity} وحدة</strong></span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(sale.date).toLocaleDateString('ar-DZ')} {new Date(sale.date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Inline Dropdown List Toggle Button */}
                    <button 
                      type="button"
                      onClick={() => toggleSaleExpand(sale.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        expandedSaleIds[sale.id] 
                          ? 'bg-indigo-950/60 text-indigo-200 border-indigo-500/50 shadow-inner' 
                          : 'bg-slate-950 text-indigo-300 border-indigo-500/20 hover:bg-indigo-950/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>المنتجات المطلوبة والكمية ({sale.items?.length || 1})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-normal">
                          {expandedSaleIds[sale.id] ? 'إخفاء' : 'عرض القائمة'}
                        </span>
                        {expandedSaleIds[sale.id] ? (
                          <ChevronUp className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Inline Dropdown List Content inside Card */}
                    {expandedSaleIds[sale.id] && (
                      <div className="bg-slate-950 rounded-xl border border-indigo-500/30 overflow-hidden text-right space-y-0 animate-in fade-in duration-200" dir="rtl">
                        <div className="p-2.5 bg-indigo-950/40 border-b border-indigo-500/20 text-[11px] font-bold text-indigo-300 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                            <span>قائمة المنتجات المطلوبة والكمية:</span>
                          </span>
                          <span className="font-mono text-emerald-400 text-xs">{formatCurrency(sale.totalPrice)}</span>
                        </div>

                        <div className="divide-y divide-slate-800/80">
                          {sale.items && sale.items.length > 0 ? (
                            sale.items.map((item, idx) => (
                              <div key={idx} className="p-3 space-y-1.5 hover:bg-slate-900/40 transition-colors">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                                    {item.productName}
                                  </span>
                                  <span className="font-extrabold text-emerald-400 font-mono">{formatCurrency(item.totalPrice)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                                  {item.sellType === 'carton' ? (
                                    <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">
                                      📦 {item.cartonsQuantity || 0} كرتون ({item.quantity} زوج)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                                      👟 {item.pairsQuantity || item.quantity} زوج / قطعة
                                    </span>
                                  )}
                                  <span className="text-slate-400">الوحدة: {formatCurrency(item.sellingPriceAtSale)}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-100">{sale.productName}</span>
                                <span className="font-extrabold text-emerald-400 font-mono">{formatCurrency(sale.totalPrice)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">
                                  الكمية: {sale.quantity} وحدة/زوج
                                </span>
                                <span className="text-slate-400">الوحدة: {formatCurrency(sale.sellingPriceAtSale)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tracking Code Badge Banner on Mobile Card */}
                    {sale.trackingCode && (
                      <div className="bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-xl flex items-center justify-between" dir="rtl">
                        <span className="text-[11px] text-indigo-300 font-bold flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-indigo-400" />
                          <span>رمز التتبع:</span>
                        </span>
                        <TrackingCodeBadge code={sale.trackingCode} />
                      </div>
                    )}

                    {(sale.customerName || sale.customerPhone || sale.customerState || sale.customerMunicipality) && (
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40 text-[11px] text-slate-300 space-y-1 text-right" dir="rtl">
                        <p className="font-bold text-[10px] text-indigo-400">معلومات الزبون:</p>
                        {sale.customerName && <p>الاسم: <span className="font-extrabold text-slate-100">{sale.customerName}</span></p>}
                        {sale.customerPhone && <p>الهاتف: <span className="font-extrabold text-slate-100 font-mono">{sale.customerPhone}</span></p>}
                        {(sale.customerState || sale.customerMunicipality) && (
                          <p>المقر: <span className="font-extrabold text-slate-100">{[sale.customerMunicipality, sale.customerState].filter(Boolean).join(' - ')}</span></p>
                        )}
                        {sale.customerColis !== undefined && (
                          <p>عدد الكوليات (الطرود): <span className="font-extrabold text-indigo-400">{sale.customerColis} طرد</span></p>
                        )}
                      </div>
                    )}

                    {/* Order Status Tracker */}
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs" dir="rtl">
                      <span className="text-slate-400 font-bold">حالة الطلب:</span>
                      <div className="flex items-center gap-2">
                        {sale.status === 'delivered' && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">تم التوصيل ✅</span>
                        )}
                        {sale.status === 'shipped' && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold">تم الشحن 🚚</span>
                        )}
                        {sale.status === 'returned' && (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">مسترجع ↩️</span>
                        )}
                        {sale.status === 'returned_to_supplier' && (
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-[10px] font-bold">معاد للمورد 🔄</span>
                        )}
                        {(sale.status === 'pending' || !sale.status) && (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-bold">قيد الانتظار ⏳</span>
                        )}

                        <select
                          value={sale.status || 'pending'}
                          onChange={(e) => onUpdateSaleStatus(sale.id, e.target.value as SaleStatus)}
                          className="bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 cursor-pointer h-7"
                        >
                          <option value="pending">تغيير: انتظار</option>
                          <option value="shipped">تغيير: شحن</option>
                          <option value="delivered">تغيير: توصيل</option>
                          <option value="returned">تغيير: إرجاع للزبون</option>
                          <option value="returned_to_supplier">تغيير: إعادة للمورد</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEditingSale(sale)}
                        className="flex-1 flex items-center justify-center gap-1 bg-amber-500/10 text-amber-400 font-bold text-xs py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        تعديل
                      </button>
                      <button 
                        onClick={() => onOpenReceiptModal(sale)}
                        className="flex-1 flex items-center justify-center gap-1 bg-indigo-500/10 text-indigo-400 font-bold text-xs py-2 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        الوصل
                      </button>
                      <button 
                        onClick={() => setSaleToDelete(sale)}
                        className="flex-1 flex items-center justify-center gap-1 bg-rose-500/10 text-rose-400 font-bold text-xs py-2 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View Table */}
              <div className="hidden md:block bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                <table className="w-full text-right border-collapse" dir="rtl">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-right">
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono text-right">معرف البيع</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">التاريخ والوقت</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">اسم المنتج</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">معلومات الزبون</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">حالة الطلب</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">الكمية</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-left">سعر الوحدة</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-left">الإجمالي الصافي</th>
                      <th className="p-4 text-xs font-bold text-emerald-400 uppercase tracking-wider text-left">الفائدة</th>
                      <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredSalesHistory.map((sale) => (
                      <Fragment key={sale.id}>
                        <tr 
                          className={`hover:bg-slate-800/60 transition-colors group ${
                            expandedSaleIds[sale.id] ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="p-4 text-right">
                            <span className="text-xs font-bold font-mono text-slate-400 group-hover:text-indigo-400 transition-colors">
                              {sale.id.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-slate-400 font-medium text-right">
                            {new Date(sale.date).toLocaleDateString('ar-DZ')} في {new Date(sale.date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="p-4 font-bold text-slate-200 text-sm text-right">
                            <div className="flex flex-col text-right">
                              <span className="font-bold group-hover:text-indigo-300 transition-colors">{sale.productName}</span>
                              {sale.items && sale.items.length > 1 && (
                                <span className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                                  +{sale.items.length - 1} منتجات فرعية مسجلة
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {sale.customerName ? (
                              <div className="text-xs space-y-0.5">
                                <p className="font-bold text-slate-300">{sale.customerName}</p>
                                {sale.customerPhone && <p className="text-slate-500 font-mono text-[10px]">{sale.customerPhone}</p>}
                                {(sale.customerState || sale.customerMunicipality) && (
                                  <p className="text-slate-500 text-[10px]">
                                    {[sale.customerMunicipality, sale.customerState].filter(Boolean).join(' - ')}
                                  </p>
                                )}
                                {sale.customerColis !== undefined && (
                                  <p className="text-indigo-400 font-bold text-[10px]">الطرود: {sale.customerColis} كولية</p>
                                )}
                                {sale.trackingCode && (
                                  <div className="mt-1">
                                    <TrackingCodeBadge code={sale.trackingCode} />
                                  </div>
                                )}
                              </div>
                            ) : sale.trackingCode ? (
                              <div className="text-xs">
                                <TrackingCodeBadge code={sale.trackingCode} />
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex flex-col gap-1 items-start">
                              {sale.status === 'delivered' && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">تم التوصيل ✅</span>
                              )}
                              {sale.status === 'shipped' && (
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold">تم الشحن 🚚</span>
                              )}
                              {sale.status === 'returned' && (
                                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">مسترجع ↩️</span>
                              )}
                              {sale.status === 'returned_to_supplier' && (
                                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-[10px] font-bold">معاد للمورد 🔄</span>
                              )}
                              {(sale.status === 'pending' || !sale.status) && (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-bold">قيد الانتظار ⏳</span>
                              )}

                              <select
                                value={sale.status || 'pending'}
                                onChange={(e) => onUpdateSaleStatus(sale.id, e.target.value as SaleStatus)}
                                className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-lg px-1.5 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 cursor-pointer h-6"
                              >
                                <option value="pending">انتظار</option>
                                <option value="shipped">تم الشحن</option>
                                <option value="delivered">تم التوصيل</option>
                                <option value="returned">مسترجع</option>
                                <option value="returned_to_supplier">إعادة للمورد</option>
                              </select>
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold text-slate-300 text-sm">
                            {sale.quantity}
                          </td>
                          <td className="p-4 text-left text-slate-400 font-semibold text-sm">
                            {formatCurrency(sale.sellingPriceAtSale)}
                          </td>
                          <td className="p-4 text-left text-slate-100 font-extrabold text-sm">
                            {formatCurrency(sale.totalPrice)}
                          </td>
                          <td className="p-4 text-left text-emerald-400 font-extrabold text-sm">
                            {formatCurrency(calculateSaleProfit(sale))}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                type="button"
                                onClick={() => toggleSaleExpand(sale.id)}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                  expandedSaleIds[sale.id]
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20'
                                }`}
                                title="عرض المنتجات المنسدلة والكميات"
                              >
                                <Package className="w-3.5 h-3.5 text-indigo-400" />
                                <span>المنتجات ({sale.items?.length || 1})</span>
                                {expandedSaleIds[sale.id] ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button 
                                onClick={() => startEditingSale(sale)}
                                className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-1.5 rounded-lg border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                title="تعديل المبيعة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => onOpenReceiptModal(sale)}
                                className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 text-xs font-bold px-2 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                                title="طباعة الوصل"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setSaleToDelete(sale)}
                                className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 text-xs font-bold px-2 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                title="حذف المبيعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline Dropdown Sub-Row for Desktop Table */}
                        {expandedSaleIds[sale.id] && (
                          <tr className="bg-slate-950/90 border-b border-indigo-500/40">
                            <td colSpan={10} className="p-4">
                              <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-right space-y-3 animate-in fade-in duration-200" dir="rtl">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-slate-100">
                                      قائمة المنتجات المطلوبة والكميات (الطلب #{sale.id.slice(0, 8).toUpperCase()})
                                    </span>
                                  </div>
                                  <span className="text-xs font-mono font-bold text-indigo-300">
                                    المبلغ الإجمالي الصافي: <strong className="text-emerald-400 text-sm font-extrabold">{formatCurrency(sale.totalPrice)}</strong>
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {sale.items && sale.items.length > 0 ? (
                                    sale.items.map((item, idx) => (
                                      <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-xs font-bold text-slate-100">{item.productName}</p>
                                          <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-900 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                                          <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-[11px]">
                                            {item.sellType === 'carton' ? `📦 ${item.cartonsQuantity || 0} كرتون (${item.quantity} زوج)` : `👟 ${item.pairsQuantity || item.quantity} زوج / قطعة`}
                                          </span>
                                          <div className="text-left">
                                            <span className="text-[10px] text-slate-500 block">المجموع</span>
                                            <span className="font-mono font-bold text-emerald-400">{formatCurrency(item.totalPrice)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between space-y-2">
                                      <p className="text-xs font-bold text-slate-100">{sale.productName}</p>
                                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                                        <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-[11px]">
                                          الكمية: {sale.quantity} وحدة/زوج
                                        </span>
                                        <div className="text-left">
                                          <span className="text-[10px] text-slate-500 block">المجموع</span>
                                          <span className="font-mono font-bold text-emerald-400">{formatCurrency(sale.totalPrice)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      )}

      {/* Custom Sale Delete Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 p-6 space-y-6 text-right">
            
            {/* Header / Warning icon */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20 shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-100">تأكيد حذف عملية البيع</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  هل أنت متأكد من رغبتك في إلغاء عملية البيع هذه؟ سيتم حذف العملية بالكامل وسيتم إرجاع كميات المنتجات المباعة تلقائياً إلى مخزن المحل.
                </p>
              </div>
            </div>

            {/* Sale details preview */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-2 text-right">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-slate-300 uppercase">{saleToDelete.id}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">المنتج:</span>
                <span className="font-bold text-slate-200">{saleToDelete.productName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">الكمية المسترجعة:</span>
                <span className="font-bold text-slate-200">{saleToDelete.quantity} زوج</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 font-bold">المبلغ المسترد:</span>
                <span className="font-extrabold text-emerald-400">{formatCurrency(saleToDelete.totalPrice)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setSaleToDelete(null)}
                className="flex-1 border border-slate-800 text-slate-400 font-bold text-xs py-3 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-colors h-11 cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                onClick={() => {
                  onDeleteSale(saleToDelete.id);
                  setSaleToDelete(null);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs py-3 rounded-xl transition-all h-11 shadow-lg shadow-rose-900/20 cursor-pointer"
              >
                نعم، احذف وأرجع المخزون
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn" dir="rtl">
          <form 
            onSubmit={handleSaveEditSale} 
            className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-800 p-6 space-y-6 text-right max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>تعديل المبيعة والفاتورة: {editingSale.id.toUpperCase()}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingSale(null)} 
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Part 1: Customer Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide">1. معلومات الزبون والشحن</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">اسم الزبون</label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="مثال: أحمد بوعلي"
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-right h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-left font-mono h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">الولاية</label>
                  <input
                    type="text"
                    value={editCustomerState}
                    onChange={(e) => setEditCustomerState(e.target.value)}
                    placeholder="الولاية..."
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-right h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">البلدية</label>
                  <input
                    type="text"
                    value={editCustomerMunicipality}
                    onChange={(e) => setEditCustomerMunicipality(e.target.value)}
                    placeholder="البلدية..."
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-right h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">عدد الكوليات (الطرود)</label>
                  <input
                    type="number"
                    min="1"
                    value={editCustomerColis}
                    onChange={(e) => setEditCustomerColis(e.target.value)}
                    placeholder="1"
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-center h-9"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-indigo-400 font-bold mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    <span>كود تتبع التوصيل</span>
                  </label>
                  <input
                    type="text"
                    value={editTrackingCode}
                    onChange={(e) => setEditTrackingCode(e.target.value)}
                    placeholder="رمز التتبع..."
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 text-right font-mono h-9"
                  />
                </div>
              </div>
            </div>

            {/* Part 2: Sale Items List / Modification */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center justify-between">
                <span>2. المشتريات والسلع في المبيعة</span>
                <span className="text-[10px] text-slate-400 font-normal">إجمالي السلع: {editItems.length}</span>
              </h4>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pl-1 pr-1">
                {editItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  const maxPairs = product ? product.quantity : 999;
                  const pairsPerCtn = product?.pairsPerCarton || 12;

                  return (
                    <div 
                      key={`${item.productId}-${idx}`}
                      className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-right"
                    >
                      {/* Product Name & SKU */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{item.productName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {item.sku || 'N/A'}</p>
                      </div>

                      {/* Sell Type Selector (Carton vs Pair) */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateEditItemSellType(idx, 'carton')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                            item.sellType === 'carton'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          كرتون
                        </button>
                        <button
                          type="button"
                          onClick={() => updateEditItemSellType(idx, 'pair')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                            item.sellType === 'pair'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          بالزوج
                        </button>
                      </div>

                      {/* Quantity & Unit Price */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Qty incrementer */}
                        <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 h-8">
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = item.sellType === 'carton' ? (item.cartonsQuantity || 1) : (item.pairsQuantity || 1);
                              updateEditItemQty(idx, currentVal - 1);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-slate-200">
                            {item.sellType === 'carton' ? item.cartonsQuantity : item.pairsQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentVal = item.sellType === 'carton' ? (item.cartonsQuantity || 1) : (item.pairsQuantity || 1);
                              updateEditItemQty(idx, currentVal + 1);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price Input */}
                        <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 h-8 px-2 w-28">
                          <input
                            type="number"
                            value={item.sellingPriceAtSale}
                            onChange={(e) => updateEditItemPrice(idx, Number(e.target.value))}
                            className="w-full bg-transparent text-xs text-slate-200 font-bold text-center focus:outline-hidden"
                            placeholder="السعر"
                          />
                          <span className="text-[8px] text-slate-500 font-bold shrink-0">د.ج</span>
                        </div>
                      </div>

                      {/* Item Total Price & Delete Button */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] text-slate-500 block">المجموع</span>
                          <span className="text-xs font-black text-emerald-400">{formatCurrency(item.totalPrice)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteEditItem(idx)}
                          className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
                          title="حذف المنتج من المبيعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Part 3: Add new product to Sale */}
            <div className="space-y-2 relative">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide">3. إضافة منتج / سلعة أخرى إلى المبيعة</h4>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  value={editProductSearch}
                  onChange={(e) => setEditProductSearch(e.target.value)}
                  placeholder="ابحث هنا لإضافة موديل/منتج آخر لهذه الفاتورة..."
                  className="w-full pr-9 pl-4 py-1.5 bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 text-xs rounded-xl h-9 text-slate-200 text-right"
                />
              </div>

              {/* Suggestions dropdown */}
              {editSearchableProducts.length > 0 && (
                <div className="absolute z-60 left-0 right-0 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-[160px] overflow-y-auto mt-1 p-1 space-y-1">
                  {editSearchableProducts.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => addProductToEditItems(prod)}
                      className="w-full text-right px-3 py-2 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="font-bold">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        SKU: {prod.sku} | المخزن: {prod.quantity} زوج
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Total price recalculator override */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
              <div>
                <span className="text-xs font-bold text-slate-400">إجمالي مبلغ الفاتورة الإجمالي (د.ج)</span>
                <p className="text-[10px] text-slate-500 mt-0.5">محسوب تلقائياً بناءً على سلة المبيعة</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={editTotalPrice}
                  onChange={(e) => setEditTotalPrice(e.target.value)}
                  className="w-36 bg-slate-950 border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/50 text-sm rounded-lg px-3 py-1.5 text-center font-black text-emerald-400"
                />
                <span className="text-xs text-slate-400 font-bold">د.ج</span>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditingSale(null)}
                className="flex-1 border border-slate-800 text-slate-400 font-bold text-xs py-2.5 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-colors h-10 cursor-pointer"
              >
                إلغاء التعديل
              </button>
              <button 
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs py-2.5 rounded-xl transition-all h-10 shadow-lg shadow-indigo-900/20 cursor-pointer"
              >
                حفظ تعديلات المبيعة 💾
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
