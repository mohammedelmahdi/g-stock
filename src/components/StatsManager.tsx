import { useState, useMemo, useEffect, FormEvent } from 'react';
import { Product, Sale, Expense, formatCurrency } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  MapPin, 
  Package, 
  ShoppingCart, 
  ChevronDown, 
  Filter, 
  X, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  Truck, 
  RotateCcw,
  Award,
  BarChart3,
  Percent,
  Coins,
  ShieldAlert,
  Save,
  HelpCircle,
  Plus,
  Trash2,
  History
} from 'lucide-react';

interface SupplierPayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

interface DeliveryPayment {
  id: string;
  amount: number;
  commission?: number;
  date: string;
  note?: string;
}

// Helper to get YYYY-MM-DD format in local timezone
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface StatsManagerProps {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  packagingPrice: number;
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all';

export default function StatsManager({
  products,
  sales,
  expenses,
  packagingPrice
}: StatsManagerProps) {
  // Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  
  // Interactive UI States
  const [hoveredChartBar, setHoveredChartBar] = useState<any | null>(null);

  // Supplier Ledger Payments State (stored in localStorage)
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() => {
    const saved = localStorage.getItem('supplier_payments_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    const oldSaved = localStorage.getItem('supplier_paid_amount');
    if (oldSaved && Number(oldSaved) > 0) {
      const initialPayment: SupplierPayment = {
        id: 'init-payment',
        amount: Number(oldSaved),
        date: getLocalDateString(new Date()),
        note: 'رصيد سابق مسجل'
      };
      const list = [initialPayment];
      localStorage.setItem('supplier_payments_history', JSON.stringify(list));
      localStorage.removeItem('supplier_paid_amount');
      return list;
    }
    return [];
  });
  const [showSupplierLedger, setShowSupplierLedger] = useState(true);
  const [supplierCalcMethod, setSupplierCalcMethod] = useState<'all_given' | 'delivered'>('all_given');
  
  // State for adding a new supplier payment
  const [newPayAmount, setNewPayAmount] = useState<string>('');
  const [newPayDate, setNewPayDate] = useState<string>(getLocalDateString(new Date()));
  const [newPayNote, setNewPayNote] = useState<string>('');
  const [payError, setPayError] = useState<string>('');

  const paidToSupplier = useMemo(() => {
    return supplierPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [supplierPayments]);

  const handleAddPayment = (e: FormEvent) => {
    e.preventDefault();
    setPayError('');
    const amt = parseFloat(newPayAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError('يرجى إدخال مبلغ صالح أكبر من 0.');
      return;
    }
    const newPayment: SupplierPayment = {
      id: 'pay-' + Date.now(),
      amount: amt,
      date: newPayDate || getLocalDateString(new Date()),
      note: newPayNote.trim() || undefined
    };
    const updated = [...supplierPayments, newPayment];
    setSupplierPayments(updated);
    localStorage.setItem('supplier_payments_history', JSON.stringify(updated));
    setNewPayAmount('');
    setNewPayNote('');
    setNewPayDate(getLocalDateString(new Date()));
  };

  const handleDeletePayment = (id: string) => {
    const updated = supplierPayments.filter(p => p.id !== id);
    setSupplierPayments(updated);
    localStorage.setItem('supplier_payments_history', JSON.stringify(updated));
  };

  // Delivery Ledger Payments State (stored in localStorage)
  const [deliveryPayments, setDeliveryPayments] = useState<DeliveryPayment[]>(() => {
    const saved = localStorage.getItem('delivery_payments_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });
  const [showDeliveryLedger, setShowDeliveryLedger] = useState(true);
  
  // State for adding a new delivery payment
  const [newDeliveryPayAmount, setNewDeliveryPayAmount] = useState<string>('');
  const [newDeliveryPayCommission, setNewDeliveryPayCommission] = useState<string>('');
  const [newDeliveryPayDate, setNewDeliveryPayDate] = useState<string>(getLocalDateString(new Date()));
  const [newDeliveryPayNote, setNewDeliveryPayNote] = useState<string>('');
  const [deliveryPayError, setDeliveryPayError] = useState<string>('');

  const receivedFromDelivery = useMemo(() => {
    return deliveryPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [deliveryPayments]);

  const receivedFromDeliveryCommission = useMemo(() => {
    return deliveryPayments.reduce((sum, p) => sum + (p.commission ?? 0), 0);
  }, [deliveryPayments]);

  const receivedFromDeliveryTotalSettled = useMemo(() => {
    return receivedFromDelivery + receivedFromDeliveryCommission;
  }, [receivedFromDelivery, receivedFromDeliveryCommission]);

  const allTimeDeliveredRevenue = useMemo(() => {
    return sales
      .filter(s => s.status === 'delivered')
      .reduce((sum, s) => sum + s.totalPrice, 0);
  }, [sales]);

  const allTimeDeliveredColisCount = useMemo(() => {
    return sales
      .filter(s => s.status === 'delivered')
      .reduce((sum, s) => sum + (s.customerColis || 1), 0);
  }, [sales]);

  const handleAddDeliveryPayment = (e: FormEvent) => {
    e.preventDefault();
    setDeliveryPayError('');
    const amt = parseFloat(newDeliveryPayAmount);
    if (isNaN(amt) || amt <= 0) {
      setDeliveryPayError('يرجى إدخال مبلغ صالح أكبر من 0.');
      return;
    }
    const comm = parseFloat(newDeliveryPayCommission) || 0;
    if (isNaN(comm) || comm < 0) {
      setDeliveryPayError('يرجى إدخال عمولة صالحة أكبر من أو تساوي 0.');
      return;
    }
    const newPayment: DeliveryPayment = {
      id: 'delpay-' + Date.now(),
      amount: amt,
      commission: comm,
      date: newDeliveryPayDate || getLocalDateString(new Date()),
      note: newDeliveryPayNote.trim() || undefined
    };
    const updated = [...deliveryPayments, newPayment];
    setDeliveryPayments(updated);
    localStorage.setItem('delivery_payments_history', JSON.stringify(updated));
    setNewDeliveryPayAmount('');
    setNewDeliveryPayCommission('');
    setNewDeliveryPayNote('');
    setNewDeliveryPayDate(getLocalDateString(new Date()));
  };

  const handleDeleteDeliveryPayment = (id: string) => {
    const updated = deliveryPayments.filter(p => p.id !== id);
    setDeliveryPayments(updated);
    localStorage.setItem('delivery_payments_history', JSON.stringify(updated));
  };

  // Extract all unique Wilayas from sales for the dropdown filter
  const allWilayas = useMemo(() => {
    const list = new Set<string>();
    sales.forEach(s => {
      if (s.customerState?.trim()) {
        list.add(s.customerState.trim());
      }
    });
    return Array.from(list).sort();
  }, [sales]);

  // Determine active date range based on preset or custom input
  const activeDateRange = useMemo(() => {
    const today = new Date();
    let start = '';
    let end = getLocalDateString(today);

    switch (datePreset) {
      case 'today':
        start = getLocalDateString(today);
        break;
      case 'yesterday': {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = getLocalDateString(yesterday);
        end = getLocalDateString(yesterday);
        break;
      }
      case 'last7': {
        const prev7 = new Date();
        prev7.setDate(today.getDate() - 6); // Includes today
        start = getLocalDateString(prev7);
        break;
      }
      case 'last30': {
        const prev30 = new Date();
        prev30.setDate(today.getDate() - 29);
        start = getLocalDateString(prev30);
        break;
      }
      case 'thisMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        start = getLocalDateString(firstDay);
        break;
      }
      case 'lastMonth': {
        const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        start = getLocalDateString(firstDayPrevMonth);
        end = getLocalDateString(lastDayPrevMonth);
        break;
      }
      case 'all':
      default:
        start = '';
        end = '';
        break;
    }

    // Override with custom dates if custom is actively filled
    if (startDate) start = startDate;
    if (endDate) end = endDate;

    return { start, end };
  }, [datePreset, startDate, endDate]);

  // Filter Sales list based on all selected criteria
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDateStr = sale.date.split('T')[0];
      const { start, end } = activeDateRange;

      // 1. Date filter
      if (start && saleDateStr < start) return false;
      if (end && saleDateStr > end) return false;

      // 2. Status filter
      if (statusFilter !== 'all') {
        const saleStatus = sale.status || 'pending';
        if (saleStatus !== statusFilter) return false;
      }

      // 3. Product filter
      if (productFilter !== 'all') {
        if (sale.items && sale.items.length > 0) {
          const hasProduct = sale.items.some(item => item.productId === productFilter);
          if (!hasProduct) return false;
        } else {
          if (sale.productId !== productFilter) return false;
        }
      }

      // 4. Wilaya/State filter
      if (wilayaFilter !== 'all') {
        if (sale.customerState?.trim() !== wilayaFilter) return false;
      }

      return true;
    });
  }, [sales, activeDateRange, statusFilter, productFilter, wilayaFilter]);

  // Filter Expenses based on date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = exp.date;
      const { start, end } = activeDateRange;

      if (start && expDate < start) return false;
      if (end && expDate > end) return false;
      return true;
    });
  }, [expenses, activeDateRange]);

  // Calculate detailed financial metrics
  const financialMetrics = useMemo(() => {
    let totalSalesVolume = 0; // total pairs sold
    let totalGrossRevenue = 0; // total money in
    let totalBuyingCost = 0; // total buying cost of sold items
    
    let deliveredRevenue = 0;
    let deliveredBuyingCost = 0;
    let deliveredPairsCount = 0;
    
    let pendingRevenue = 0;
    let pendingBuyingCost = 0;
    
    let shippedRevenue = 0; // المال في الطريق
    let shippedBuyingCost = 0;
    
    let returnedCount = 0;
    let returnedRevenue = 0;
    let returnedBuyingCost = 0;
    
    let returnedToSupplierCount = 0;
    let returnedToSupplierBuyingCost = 0;
    
    let totalColisCount = 0;
    let deliveredColisCount = 0;
    let returnedColisCount = 0;

    filteredSales.forEach(sale => {
      const status = sale.status || 'pending';
      const colis = sale.customerColis || 1;
      totalColisCount += colis;

      // Extract quantities and costs
      let saleQty = sale.quantity;
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

      totalSalesVolume += saleQty;
      totalGrossRevenue += sale.totalPrice;
      totalBuyingCost += buyingCost;

      if (status === 'delivered') {
        deliveredRevenue += sale.totalPrice;
        deliveredBuyingCost += buyingCost;
        deliveredPairsCount += saleQty;
        deliveredColisCount += colis;
      } else if (status === 'pending') {
        pendingRevenue += sale.totalPrice;
        pendingBuyingCost += buyingCost;
      } else if (status === 'shipped') {
        shippedRevenue += sale.totalPrice;
        shippedBuyingCost += buyingCost;
      } else if (status === 'returned') {
        returnedCount++;
        returnedRevenue += sale.totalPrice;
        returnedBuyingCost += buyingCost;
        returnedColisCount += colis;
      } else if (status === 'returned_to_supplier') {
        returnedToSupplierCount++;
        returnedToSupplierBuyingCost += buyingCost;
        returnedColisCount += colis;
      }
    });

    // Operational expenses in the selected period
    const totalExpensesAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Packaging cost based on filtered sales' parcels
    const totalPackagingCost = totalColisCount * packagingPrice;

    // Sunk packaging and operational expenses from returned packages
    // User: "السلع المسترجعة تعود له لاكن المصاريف تبقى علي"
    // Packaging cost for returned parcels is a complete loss.
    const returnedPackagingLoss = returnedColisCount * packagingPrice;

    // Filter Delivery Payments based on date range to calculate period commission
    const filteredPeriodDeliveryPayments = deliveryPayments.filter(p => {
      const { start, end } = activeDateRange;
      if (start && p.date < start) return false;
      if (end && p.date > end) return false;
      return true;
    });

    // Sum of commissions for delivery payments in the active period
    const totalDeliveryCommission = filteredPeriodDeliveryPayments.reduce((sum, p) => sum + (p.commission ?? 0), 0);

    // Gross profits
    const totalPotentialProfit = totalGrossRevenue - totalBuyingCost; // Profit if all are delivered
    const actualDeliveredProfit = deliveredRevenue - deliveredBuyingCost; // Realized product profit

    // Net cash flow and actual net profit
    // Net profit = actual delivered profit - operational expenses - total packaging costs of all parcels - delivery collection commissions
    const netProfit = actualDeliveredProfit - totalExpensesAmount - totalPackagingCost - totalDeliveryCommission;

    // Delivery Success Rate
    const totalFinishedSales = filteredSales.filter(s => s.status === 'delivered' || s.status === 'returned' || s.status === 'returned_to_supplier').length;
    const deliveryRate = totalFinishedSales > 0 
      ? Math.round((filteredSales.filter(s => s.status === 'delivered').length / totalFinishedSales) * 100) 
      : 0;

    return {
      totalSalesVolume,
      totalGrossRevenue,
      totalBuyingCost,
      deliveredRevenue,
      deliveredBuyingCost,
      deliveredPairsCount,
      deliveredColisCount,
      pendingRevenue,
      shippedRevenue,
      returnedCount,
      returnedRevenue,
      returnedBuyingCost,
      returnedToSupplierCount,
      returnedToSupplierBuyingCost,
      returnedColisCount,
      returnedPackagingLoss,
      totalExpensesAmount,
      totalPackagingCost,
      totalDeliveryCommission,
      totalPotentialProfit,
      actualDeliveredProfit,
      netProfit,
      deliveryRate,
      totalColisCount,
      totalSalesCount: filteredSales.length
    };
  }, [filteredSales, filteredExpenses, products, packagingPrice, deliveryPayments, activeDateRange]);

  // Breakdown of Delivered Items for Supplier Accounts Settle (تحاسب المورد)
  const supplierDeliveredBreakdown = useMemo(() => {
    const breakdownMap = new Map<string, {
      id: string;
      name: string;
      sku: string;
      cartonsDelivered: number;
      pairsDelivered: number;
      singleBuyingPrice: number;
      cartonBuyingPrice: number;
      totalBuyingCost: number;
    }>();

    filteredSales.forEach(sale => {
      if (sale.status !== 'delivered') return;

      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const pairsPerCtn = product?.pairsPerCarton || 12;

          let singleBuying = 0;
          let cartonBuying = 0;
          let itemCost = 0;

          if (item.sellType === 'carton') {
            cartonBuying = item.buyingPriceAtSale || 0;
            singleBuying = cartonBuying / pairsPerCtn;
            itemCost = (item.cartonsQuantity || 0) * cartonBuying;
          } else {
            singleBuying = item.buyingPriceAtSale || 0;
            cartonBuying = singleBuying * pairsPerCtn;
            itemCost = (item.pairsQuantity || item.quantity || 0) * singleBuying;
          }

          const record = breakdownMap.get(item.productId) || {
            id: item.productId,
            name: item.productName,
            sku: item.sku || 'N/A',
            cartonsDelivered: 0,
            pairsDelivered: 0,
            singleBuyingPrice: singleBuying,
            cartonBuyingPrice: cartonBuying,
            totalBuyingCost: 0,
          };

          if (item.sellType === 'carton') {
            record.cartonsDelivered += item.cartonsQuantity || 0;
          } else {
            record.pairsDelivered += item.pairsQuantity || item.quantity || 0;
          }
          record.totalBuyingCost += itemCost;

          breakdownMap.set(item.productId, record);
        });
      } else {
        // Flat structure fallback
        const singleBuying = sale.buyingPriceAtSale || 0;
        const cartonBuying = singleBuying * 12;
        const itemCost = sale.quantity * singleBuying;

        const record = breakdownMap.get(sale.productId) || {
          id: sale.productId,
          name: sale.productName,
          sku: 'N/A',
          cartonsDelivered: 0,
          pairsDelivered: 0,
          singleBuyingPrice: singleBuying,
          cartonBuyingPrice: cartonBuying,
          totalBuyingCost: 0,
        };

        record.pairsDelivered += sale.quantity;
        record.totalBuyingCost += itemCost;

        breakdownMap.set(sale.productId, record);
      }
    });

    return Array.from(breakdownMap.values());
  }, [filteredSales, products]);

  // Breakdown of Delivered Sales for Delivery Cash Collection (تحصيل أموال التوصيل)
  const deliveryDeliveredBreakdown = useMemo(() => {
    return filteredSales
      .filter(sale => sale.status === 'delivered')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredSales]);

  // Order count tracking by status (تتبع أعداد الطلبيات حسب حالتها)
  const orderStatusTracking = useMemo(() => {
    const tracking = {
      pending: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 },
      shipped: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 },
      delivered: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 },
      returned: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 },
      returnedToSupplier: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 },
      total: { count: 0, revenue: 0, colis: 0, profit: 0, buyingCost: 0 }
    };

    filteredSales.forEach(sale => {
      const status = sale.status || 'pending';
      const col = sale.customerColis || 1;
      const rev = sale.totalPrice;

      // Extract quantities and costs
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

      const saleProfit = rev - buyingCost;

      if (status === 'delivered') {
        tracking.delivered.count += 1;
        tracking.delivered.revenue += rev;
        tracking.delivered.colis += col;
        tracking.delivered.profit += saleProfit;
        tracking.delivered.buyingCost += buyingCost;

        tracking.total.count += 1;
        tracking.total.revenue += rev;
        tracking.total.colis += col;
        tracking.total.profit += saleProfit;
        tracking.total.buyingCost += buyingCost;
      } else if (status === 'shipped') {
        tracking.shipped.count += 1;
        tracking.shipped.revenue += rev;
        tracking.shipped.colis += col;
        tracking.shipped.profit += saleProfit;
        tracking.shipped.buyingCost += buyingCost;

        tracking.total.count += 1;
        tracking.total.revenue += rev;
        tracking.total.colis += col;
        tracking.total.profit += saleProfit;
        tracking.total.buyingCost += buyingCost;
      } else if (status === 'returned') {
        tracking.returned.count += 1;
        tracking.returned.revenue += rev;
        tracking.returned.colis += col;
        // Sunk packaging cost loss for returned items
        tracking.returned.profit -= col * packagingPrice;
        tracking.returned.buyingCost += buyingCost;

        tracking.total.count += 1;
        tracking.total.revenue += rev;
        tracking.total.colis += col;
        tracking.total.profit -= col * packagingPrice;
        tracking.total.buyingCost += buyingCost;
      } else if (status === 'returned_to_supplier') {
        tracking.returnedToSupplier.count += 1;
        tracking.returnedToSupplier.revenue += rev;
        tracking.returnedToSupplier.colis += col;
        // Sunk packaging cost loss for returned items
        tracking.returnedToSupplier.profit -= col * packagingPrice;
        tracking.returnedToSupplier.buyingCost += buyingCost;

        tracking.total.count += 1;
        tracking.total.revenue += rev;
        tracking.total.colis += col;
        tracking.total.profit -= col * packagingPrice;
        tracking.total.buyingCost += buyingCost;
      } else if (status === 'pending') {
        tracking.pending.count += 1;
        tracking.pending.revenue += rev;
        tracking.pending.colis += col;
        tracking.pending.profit += saleProfit;
        tracking.pending.buyingCost += buyingCost;

        tracking.total.count += 1;
        tracking.total.revenue += rev;
        tracking.total.colis += col;
        tracking.total.profit += saleProfit;
        tracking.total.buyingCost += buyingCost;
      }
    });

    return tracking;
  }, [filteredSales, products, packagingPrice]);

  // Daily Sales trend chart calculator (tracks revenue & profits daily over range)
  const chartDailyTrend = useMemo(() => {
    const dailyMap = new Map<string, {
      dateLabel: string;
      revenue: number;
      profit: number;
      salesCount: number;
    }>();

    filteredSales.forEach(sale => {
      const dayStr = sale.date.split('T')[0]; // YYYY-MM-DD
      const stat = dailyMap.get(dayStr) || {
        dateLabel: dayStr,
        revenue: 0,
        profit: 0,
        salesCount: 0
      };

      stat.revenue += sale.totalPrice;
      stat.salesCount += 1;

      // Profit calculation
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

      stat.profit += (sale.totalPrice - buyingCost);
      dailyMap.set(dayStr, stat);
    });

    const sortedDays = Array.from(dailyMap.values())
      .sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));

    return sortedDays;
  }, [filteredSales, products]);

  // Clear all filters
  const resetFilters = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setProductFilter('all');
    setWilayaFilter('all');
  };

  return (
    <div className="space-y-6 animate-fade-in text-right" dir="rtl">
      
      {/* 1. Header with Reset Filters Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>مركز الإحصائيات والتحليل المالي</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">تتبع التدفقات المالية للمبيعات، حسابات الموردين، خسائر المرتجعات، والنسب الجغرافية بدقة.</p>
        </div>
        
        {/* Quick Reset Button if filters are active */}
        {(datePreset !== 'all' || statusFilter !== 'all' || productFilter !== 'all' || wilayaFilter !== 'all' || startDate || endDate) && (
          <button 
            onClick={resetFilters}
            className="self-start md:self-auto flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>إعادة تعيين الفلاتر</span>
          </button>
        )}
      </div>

      {/* 2. Interactive Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 pb-2 border-b border-slate-800">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">فلترة البيانات والتقارير المخصصة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Preset Date Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1.5">الفترة الزمنية</label>
            <div className="relative">
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value as DatePreset);
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 cursor-pointer appearance-none text-right"
              >
                <option value="all">كل الأوقات</option>
                <option value="today">اليوم</option>
                <option value="yesterday">البارحة</option>
                <option value="last7">آخر 7 أيام</option>
                <option value="last30">آخر 30 يوم</option>
                <option value="thisMonth">هذا الشهر</option>
                <option value="lastMonth">الشهر الماضي</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1.5">حالة الطلبية</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 cursor-pointer appearance-none text-right"
              >
                <option value="all">كل الحالات</option>
                <option value="delivered">تم التوصيل ✅</option>
                <option value="pending">قيد الانتظار ⏳</option>
                <option value="shipped">قيد الشحن 🚚</option>
                <option value="returned">مسترجع ❌</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Wilaya Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1.5">الولاية</label>
            <div className="relative">
              <select
                value={wilayaFilter}
                onChange={(e) => setWilayaFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 cursor-pointer appearance-none text-right"
              >
                <option value="all">كل الولايات ({allWilayas.length})</option>
                {allWilayas.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1.5">موديل المنتج</label>
            <div className="relative">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-indigo-500 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 cursor-pointer appearance-none text-right"
              >
                <option value="all">جميع الموديلات ({products.length})</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Custom Start/End Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1">من تاريخ</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('all');
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 text-right font-mono"
              />
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-1">إلى تاريخ</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('all');
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 outline-hidden h-10 text-right font-mono"
              />
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Deep-Dive Delivered & Returns Financials (الطرود المسلمة و المرتجعات) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card A: الطرود المستلمة وتفصيل أرباحها الحقيقية */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950/15 p-5 rounded-2xl border border-emerald-500/20 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>الطرود المسلّمة والمدخول الحقيقي</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {financialMetrics.deliveredColisCount} طرود مستلمة
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">قيمة السلع المستلمة (البيع):</span>
                <span className="text-sm font-black text-slate-100">{formatCurrency(financialMetrics.deliveredRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">رأس مال السلع (للمورد):</span>
                <span className="text-sm font-extrabold text-slate-300">{formatCurrency(financialMetrics.deliveredBuyingCost)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-xs text-emerald-400 font-black">أرباح المنتجات الموصلة:</span>
                <span className="text-base font-black text-emerald-400">
                  {formatCurrency(financialMetrics.deliveredRevenue - financialMetrics.deliveredBuyingCost)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
            * هذه الأرباح تمثل الفرق بين سعر البيع وتكلفة شراء البضائع للطرود التي وصلت وتم تسليمها للزبون بالفعل.
          </p>
        </div>

        {/* Card B: الطرود المسترجعة وخسائرها (السلع للمورد والمصاريف علي) */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950/15 p-5 rounded-2xl border border-rose-500/20 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <span>المرتجعات (السلع للمورد والمصاريف علي)</span>
              </h3>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                {financialMetrics.returnedCount} مسترجع
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">قيمة البضائع المسترجعة:</span>
                <span className="text-sm font-extrabold text-slate-300">{formatCurrency(financialMetrics.returnedBuyingCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">عدد الكوليات المسترجعة:</span>
                <span className="text-sm font-black text-slate-200">{financialMetrics.returnedColisCount} طرد</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-rose-400">
                <span className="text-xs font-black">خسائر التغليف والتوصيل المهدرة:</span>
                <span className="text-base font-black">
                  -{formatCurrency(financialMetrics.returnedPackagingLoss)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-rose-300 mt-4 leading-relaxed bg-rose-950/20 p-2.5 rounded-xl border border-rose-900/30">
            💡 <strong>ملاحظة هامة:</strong> البضاعة المسترجعة لا نخسر قيمتها لأنها تعود للمورد مجاناً، لكننا نتحمل خسارة التغليف والتوصيل للمرتجعات.
          </p>
        </div>

        {/* Card C: صافي الأرباح الكلي للنشاط (Net Profit) */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950/30 p-5 rounded-2xl border border-indigo-500/40 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-indigo-950">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-indigo-400" />
                <span>صافي الأرباح الكلي للنشاط (Net Profit)</span>
              </h3>
              <span className="text-xs font-black text-indigo-400">مجموع كل شيء</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">أرباح المنتجات الموصلة:</span>
                <span className="text-slate-200 font-bold">+{formatCurrency(financialMetrics.deliveredRevenue - financialMetrics.deliveredBuyingCost)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">إجمالي المصاريف التشغيلية:</span>
                <span className="text-slate-200 font-bold">-{formatCurrency(financialMetrics.totalExpensesAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">إجمالي تكاليف التغليف (كل الطرود):</span>
                <span className="text-slate-200 font-bold">-{formatCurrency(financialMetrics.totalPackagingCost)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">اقتطاعات وعمولة شركة التوصيل:</span>
                  <span className="text-[10px] text-rose-400 font-bold">(المسجلة يدوياً)</span>
                </div>
                <span className="text-slate-200 font-bold">-{formatCurrency(financialMetrics.totalDeliveryCommission)}</span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-800/60">
                <span className="text-xs text-emerald-400 font-extrabold">الربح الصافي الحقيقي للنشاط:</span>
                <span className="text-lg font-black text-emerald-400">
                  {formatCurrency(financialMetrics.netProfit)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-800/40 flex items-center gap-1 text-[10px] text-indigo-300">
            <span>الصافي = (أرباح التوصيل - المصاريف - التغليف - عمولة التوصيل)</span>
          </div>
        </div>

      </div>

      {/* 4. Supplier Ledger Section (تتبع حساب المورد وتسوية السلع الموصلة والمسترجعة) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Toggleable header */}
        <div 
          onClick={() => setShowSupplierLedger(!showSupplierLedger)}
          className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-950/80 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100">🤝 كشف حساب المورد وتسوية السلع (Delivered Supplier Ledger)</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">احسب قيمة السلع المستلمة لتتحاسب مع المورد، وتتبع المبالغ المدفوعة والمتبقية له.</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showSupplierLedger ? 'rotate-180' : ''}`} />
        </div>

        {showSupplierLedger && (
          <div className="p-5 space-y-6">
            
            {/* Calculation Method Selection Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-2xl gap-1">
              <button
                type="button"
                onClick={() => setSupplierCalcMethod('all_given')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  supplierCalcMethod === 'all_given'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الطريقة 1: كل البضاعة المعطاة (+ التغليف - المرتجعات)
              </button>
              <button
                type="button"
                onClick={() => setSupplierCalcMethod('delivered')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  supplierCalcMethod === 'delivered'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الطريقة 2: البضاعة الموصلة فقط (حسب التسليم)
              </button>
            </div>

            {/* Payment status & Balance calculator based on selected method */}
            {supplierCalcMethod === 'all_given' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/60">
                
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">1. مجموع السلع المعطاة (كل البضاعة):</span>
                  <span className="text-base font-black text-slate-100">{formatCurrency(financialMetrics.totalBuyingCost)}</span>
                  <span className="block text-[9px] text-indigo-400 mt-1 font-bold">
                    ({financialMetrics.totalSalesVolume} قطعة مرسلة بسعر الشراء)
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">2. تكاليف التغليف (+):</span>
                  <span className="text-base font-black text-orange-400">{formatCurrency(financialMetrics.totalPackagingCost)}</span>
                  <span className="block text-[9px] text-slate-500 mt-1 font-bold">تكلفة التغليف الكلية</span>
                </div>

                <div>
                  <span className="block text-[10px] text-rose-400 font-bold mb-1">3. قيمة السلع المعادة للمورد (-):</span>
                  <span className="text-base font-black text-rose-500">-{formatCurrency(financialMetrics.returnedToSupplierBuyingCost || 0)}</span>
                  <span className="block text-[9px] text-rose-400 mt-1 font-bold">
                    ({financialMetrics.returnedToSupplierCount || 0} طلبية معادة للمورد) بسعر الشراء
                  </span>
                </div>

                <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/20">
                  <span className="block text-[10px] text-emerald-400 font-bold mb-1">4. إجمالي مستحقات المورد:</span>
                  <span className="text-base font-black text-emerald-400">
                    {formatCurrency(financialMetrics.totalBuyingCost + financialMetrics.totalPackagingCost - (financialMetrics.returnedToSupplierBuyingCost || 0))}
                  </span>
                  <span className="block text-[8.5px] text-slate-400 mt-1">
                    (البضاعة + التغليف - المعاد للمورد)
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">5. إجمالي المدفوع للمورد:</span>
                  <span className="text-base font-black text-indigo-400">{formatCurrency(paidToSupplier)}</span>
                  <span className="block text-[9px] text-slate-400 mt-1 font-bold">
                    ({supplierPayments.length} دفعات مسجلة)
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
                  <span className="block text-[10px] text-slate-400 font-bold">6. المستحقات المتبقية للمورد:</span>
                  <span className={`text-lg font-black mt-1 block ${
                    ((financialMetrics.totalBuyingCost + financialMetrics.totalPackagingCost - (financialMetrics.returnedToSupplierBuyingCost || 0)) - paidToSupplier) > 0 ? 'text-amber-500' : 'text-emerald-400'
                  }`}>
                    {formatCurrency((financialMetrics.totalBuyingCost + financialMetrics.totalPackagingCost - (financialMetrics.returnedToSupplierBuyingCost || 0)) - paidToSupplier)}
                  </span>
                  <span className="block text-[8.5px] text-slate-500 mt-0.5">الباقي = (المستحقات الكلية - المدفوع)</span>
                </div>

              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/60">
                
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">1. ثمن البضاعة الموصلة فعلياً:</span>
                  <span className="text-base font-black text-slate-100">{formatCurrency(financialMetrics.deliveredBuyingCost)}</span>
                  <span className="block text-[9px] text-emerald-400 mt-1 font-bold">
                    ({financialMetrics.deliveredPairsCount} قطعة تم بيعها وتوصيلها بسعر الشراء)
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">2. قيمة السلع المسترجعة والمعاد المعفاة:</span>
                  <span className="text-base font-black text-rose-400">{formatCurrency(financialMetrics.returnedBuyingCost + (financialMetrics.returnedToSupplierBuyingCost || 0))}</span>
                  <span className="block text-[9px] text-rose-300 mt-1 font-bold">
                    ({financialMetrics.returnedCount} مسترجع + {financialMetrics.returnedToSupplierCount || 0} معاد للمورد) بسعر الشراء معفاة
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">3. إجمالي المبالغ المدفوعة للمورد:</span>
                  <span className="text-base font-black text-indigo-400">{formatCurrency(paidToSupplier)}</span>
                  <span className="block text-[9px] text-slate-400 mt-1 font-bold">
                    ({supplierPayments.length} دفعات مسجلة)
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-center">
                  <span className="block text-[10px] text-slate-400 font-bold">4. المستحقات المتبقية للمورد:</span>
                  <span className={`text-lg font-black mt-1 block ${
                    (financialMetrics.deliveredBuyingCost - paidToSupplier) > 0 ? 'text-amber-500' : 'text-emerald-400'
                  }`}>
                    {formatCurrency(financialMetrics.deliveredBuyingCost - paidToSupplier)}
                  </span>
                  <span className="block text-[8.5px] text-slate-500 mt-0.5">الباقي = (تكلفة الموصلة - المدفوع)</span>
                </div>

              </div>
            )}

            {/* NEW: Supplier Payments History & Add Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-800/60">
              
              {/* Form to Add Payment (5 columns) */}
              <div className="lg:col-span-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                <h4 className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>تسجيل دفعة مالية جديدة للمورد</span>
                </h4>

                {payError && (
                  <p className="text-[11px] font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/10">
                    {payError}
                  </p>
                )}

                <form onSubmit={handleAddPayment} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">المبلغ المدفوع (د.ج) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="مثال: 15000"
                      value={newPayAmount}
                      onChange={(e) => setNewPayAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-left font-mono h-9"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">تاريخ الدفع *</label>
                    <input
                      type="date"
                      required
                      value={newPayDate}
                      onChange={(e) => setNewPayDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-mono h-9"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">ملاحظة أو بيان (اختياري)</label>
                    <input
                      type="text"
                      placeholder="مثال: دفعة نقدية / تحويل CCP"
                      value={newPayNote}
                      onChange={(e) => setNewPayNote(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-right h-9"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer h-9"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة الدفعة وحفظ السجل</span>
                  </button>
                </form>
              </div>

              {/* History list of payments (7 columns) */}
              <div className="lg:col-span-7 bg-slate-950/20 p-4 rounded-xl border border-slate-800/40 space-y-3">
                <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>سجل دفعات المورد التاريخية ({supplierPayments.length})</span>
                </h4>

                {supplierPayments.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                    لم يتم تسجيل أي دفعات مالية لهذا المورد بعد.
                  </div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 font-sans">
                    {supplierPayments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-right"
                      >
                        <div>
                          <span className="text-xs font-black text-slate-100">{formatCurrency(p.amount)}</span>
                          {p.note && <p className="text-[10px] text-slate-400 mt-0.5">{p.note}</p>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-mono">{p.date}</span>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/10 rounded-lg text-rose-400 transition-colors cursor-pointer"
                            title="حذف الدفعة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>



          </div>
        )}

      </div>

      {/* 5. Delivery Company Payments Ledger (تتبع تحصيل المستحقات المالية من شركة التوصيل) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Toggleable header */}
        <div 
          onClick={() => setShowDeliveryLedger(!showDeliveryLedger)}
          className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-950/80 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-100">🚚 كشف حساب ومتابعة أموال شركة التوصيل (التحصيلات والدفعات)</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">تتبع المبالغ التي جمعتها شركة التوصيل من الزبائن، وسجل الدفعات المستلمة منها لمعرفة أموالك المتبقية لديها.</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showDeliveryLedger ? 'rotate-180' : ''}`} />
        </div>

        {showDeliveryLedger && (
          <div className="p-5 space-y-6">
            
            {/* Payment status & Balance calculator */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/60">
              
              <div className="space-y-2">
                <span className="block text-[10px] text-slate-400 font-bold">1. إجمالي تحصيلات الطلبيات الموصلة:</span>
                <div>
                  <span className="text-xs text-slate-400 block">إجمالي الكل (تاريخي):</span>
                  <span className="text-base font-black text-slate-100">{formatCurrency(allTimeDeliveredRevenue)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800/40">
                  <span className="text-[10px] text-slate-400 block">الفترة المحددة:</span>
                  <span className="text-xs font-bold text-slate-300">{formatCurrency(financialMetrics.deliveredRevenue)}</span>
                  <span className="block text-[9px] text-emerald-400 font-bold mt-0.5">
                    ({financialMetrics.deliveredColisCount} طرد موصل في الفترة)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] text-indigo-400 font-bold">2. دفعات شركة التوصيل والعمولات:</span>
                <div>
                  <span className="text-xs text-slate-400 block">إجمالي الصافي المستلم:</span>
                  <span className="text-base font-black text-emerald-400">{formatCurrency(receivedFromDelivery)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800/40 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>إجمالي العمولات المقتطعة:</span>
                    <span className="text-rose-400 font-bold">-{formatCurrency(receivedFromDeliveryCommission)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/20">
                    <span>إجمالي المسوى من الحساب:</span>
                    <span className="text-indigo-400 font-black">{formatCurrency(receivedFromDeliveryTotalSettled)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold">3. المستحقات المتبقية في ذمة شركة التوصيل:</span>
                  <span className={`text-lg font-black mt-1 block ${
                    (allTimeDeliveredRevenue - receivedFromDeliveryTotalSettled) > 0 ? 'text-amber-500' : 'text-emerald-400'
                  }`}>
                    {formatCurrency(Math.max(0, allTimeDeliveredRevenue - receivedFromDeliveryTotalSettled))}
                  </span>
                </div>
                <span className="block text-[9px] text-slate-500 mt-2">الباقي = (إجمالي المبيعات الموصلة - إجمالي المسوى [الصافي المستلم + المقتطعات])</span>
              </div>

            </div>

            {/* Delivery Payments History & Add Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-800/60">
              
              {/* Form to Add Payment (5 columns) */}
              <div className="lg:col-span-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>تسجيل دفعة مستلمة جديدة من شركة التوصيل</span>
                </h4>

                {deliveryPayError && (
                  <p className="text-[11px] font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/10">
                    {deliveryPayError}
                  </p>
                )}

                <form onSubmit={handleAddDeliveryPayment} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">المبلغ الصافي المستلم فعلياً (د.ج) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="مثال: 45000"
                      value={newDeliveryPayAmount}
                      onChange={(e) => setNewDeliveryPayAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-left font-mono h-9"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">المبلغ المقتطع (العمولة / مصاريف التوصيل) د.ج</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="مثال: 540"
                      value={newDeliveryPayCommission}
                      onChange={(e) => setNewDeliveryPayCommission(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-left font-mono h-9"
                    />
                    <span className="block text-[8.5px] text-slate-500 mt-0.5">اتركها فارغة أو 0 إذا لم يكن هناك اقتطاع.</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">تاريخ استلام الدفعة *</label>
                    <input
                      type="date"
                      required
                      value={newDeliveryPayDate}
                      onChange={(e) => setNewDeliveryPayDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-mono h-9"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">رقم الفاتورة/البيان أو ملاحظة (اختياري)</label>
                    <input
                      type="text"
                      placeholder="مثال: دفعة كشف حساب رقم #1024"
                      value={newDeliveryPayNote}
                      onChange={(e) => setNewDeliveryPayNote(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-100 outline-hidden focus:ring-1 focus:ring-indigo-500 text-right h-9"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer h-9"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة الدفعة لحساب الشركة</span>
                  </button>
                </form>
              </div>

              {/* History list of payments (7 columns) */}
              <div className="lg:col-span-7 bg-slate-950/20 p-4 rounded-xl border border-slate-800/40 space-y-3">
                <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>سجل الدفعات المستلمة التاريخي ({deliveryPayments.length})</span>
                </h4>

                {deliveryPayments.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                    لم يتم تسجيل أي دفعات مالية مستلمة من شركة التوصيل بعد.
                  </div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 font-sans">
                    {deliveryPayments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-right"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-400">{formatCurrency(p.amount)}</span>
                            <span className="text-[9px] text-slate-500">(الصافي المستلم)</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">
                            <span className="text-rose-400 font-bold">الاقتطاع / العمولة: -{formatCurrency(p.commission ?? 0)}</span>
                            <span>•</span>
                            <span className="text-indigo-400 font-bold">المسوى الكلي: {formatCurrency(p.amount + (p.commission ?? 0))}</span>
                          </div>
                          {p.note && <p className="text-[10px] text-slate-400 mt-1 font-sans">{p.note}</p>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-mono">{p.date}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeliveryPayment(p.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/10 rounded-lg text-rose-400 transition-colors cursor-pointer"
                            title="حذف الدفعة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>



          </div>
        )}

      </div>

      {/* 6. SVG Interactive Trend Chart */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-slate-100">النمو اليومي وحركة الأرباح والمبيعات</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">يوضح حركة إجمالي المبيعات مقابل هوامش الربح اليومية خلال الفترة المحددة.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-slate-300 font-bold">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded-xs"></span>
              المبيعات الإجمالية
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span>
              هامش الأرباح التقديري
            </span>
          </div>
        </div>

        {chartDailyTrend.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 space-y-2">
            <BarChart3 className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-bold text-slate-400">لا توجد بيانات مبيعات لعرض الرسم البياني.</p>
            <p className="text-[10px] text-slate-500">جرب توسيع الفترة الزمنية أو إزالة فلاتر التصفية النشطة.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="h-64 w-full bg-slate-950/30 rounded-xl p-4 flex items-end relative overflow-hidden">
              
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                <div className="w-full border-t border-slate-800/40"></div>
                <div className="w-full border-t border-slate-800/40"></div>
                <div className="w-full border-t border-slate-800/40"></div>
                <div className="w-full border-t border-slate-800/40"></div>
                <div className="w-full border-t border-slate-800/40"></div>
              </div>

              <div className="w-full h-full flex items-end justify-around gap-2 z-10 pt-6 pb-2">
                {chartDailyTrend.map((day) => {
                  const maxAmt = Math.max(...chartDailyTrend.map(d => d.revenue), 100);
                  const revHeight = (day.revenue / maxAmt) * 85;
                  const profitHeight = (day.profit / maxAmt) * 85;

                  const isHovered = hoveredChartBar && hoveredChartBar.dateLabel === day.dateLabel;

                  return (
                    <div 
                      key={day.dateLabel}
                      className="flex-1 flex flex-col items-center relative group cursor-pointer"
                      onMouseEnter={() => setHoveredChartBar(day)}
                      onMouseLeave={() => setHoveredChartBar(null)}
                    >
                      <div className="w-full max-w-[40px] h-[180px] flex items-end justify-center gap-1 relative">
                        
                        {/* Revenue Bar (Indigo) */}
                        <div 
                          className={`w-3 sm:w-4 rounded-t-xs transition-all duration-300 ${
                            isHovered ? 'bg-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-indigo-600/80'
                          }`}
                          style={{ height: `${revHeight}%` }}
                        ></div>

                        {/* Profit Bar (Emerald) */}
                        <div 
                          className={`w-3 sm:w-4 rounded-t-xs transition-all duration-300 ${
                            isHovered ? 'bg-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/80'
                          }`}
                          style={{ height: `${profitHeight}%` }}
                        ></div>

                      </div>

                      <span className="text-[9px] text-slate-500 mt-2 font-mono truncate max-w-[60px] text-center block">
                        {day.dateLabel.substring(5)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {hoveredChartBar && (
                <div 
                  className="absolute z-20 bg-slate-900 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-right text-xs space-y-1.5 transition-all duration-200"
                  style={{
                    bottom: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    minWidth: '180px'
                  }}
                >
                  <p className="font-bold text-slate-300 text-[10px] border-b border-slate-800 pb-1 flex justify-between">
                    <span>التاريخ:</span>
                    <span className="font-mono">{hoveredChartBar.dateLabel}</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="text-slate-400">إجمالي المبيعات:</span>
                    <span className="font-black text-indigo-400">{formatCurrency(hoveredChartBar.revenue)}</span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="text-slate-400">الأرباح التقديرية:</span>
                    <span className="font-black text-emerald-400">{formatCurrency(hoveredChartBar.profit)}</span>
                  </p>
                  <p className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>عدد المبيعات:</span>
                    <span>{hoveredChartBar.salesCount} مبيعات</span>
                  </p>
                </div>
              )}

            </div>
            
            <p className="text-[10px] text-center text-slate-500 mt-2 font-bold">💡 مرر مؤشر الماوس فوق الأعمدة البيانية لعرض التفاصيل اليومية لكل يوم.</p>
          </div>
        )}
      </div>

      {/* 6. Detailed Order Counts and Statistics tracking by Status */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              <span>تتبع أعداد وتفاصيل الطلبيات حسب حالتها</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">يوضح تفصيلاً دقيقاً لأعداد الطرود، قيمتها الإجمالية، ونسبتها المئوية من إجمالي الطلبيات النشطة.</p>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg shrink-0 self-start sm:self-auto font-mono">
            إجمالي الطلبيات: {orderStatusTracking.total.count} | {orderStatusTracking.total.colis} طرود
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          
          {/* Delivered Status Card */}
          <div className="bg-gradient-to-br from-slate-950/40 to-emerald-950/5 p-4 rounded-xl border border-emerald-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>تم التوصيل ✅</span>
              </span>
              <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
                {orderStatusTracking.total.count > 0 ? Math.round((orderStatusTracking.delivered.count / orderStatusTracking.total.count) * 100) : 0}%
              </span>
            </div>
            
            <div className="space-y-1.5 text-right">
              <p className="text-xl font-black text-emerald-400">{orderStatusTracking.delivered.count} <span className="text-xs text-slate-500 font-bold">طلبيات</span></p>
              <p className="text-[10px] text-slate-400">عدد الطرود: {orderStatusTracking.delivered.colis} طرد</p>
              
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة البيع (المداخيل):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.delivered.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة الشراء (تكلفة السلع):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.delivered.buyingCost)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-emerald-400 font-bold">الفائدة المحققة:</span>
                  <span className="font-black text-emerald-400">{formatCurrency(orderStatusTracking.delivered.profit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipped Status Card */}
          <div className="bg-gradient-to-br from-slate-950/40 to-blue-950/5 p-4 rounded-xl border border-blue-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>تم الشحن 🚚</span>
              </span>
              <span className="text-[10px] font-mono font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-sm">
                {orderStatusTracking.total.count > 0 ? Math.round((orderStatusTracking.shipped.count / orderStatusTracking.total.count) * 100) : 0}%
              </span>
            </div>
            
            <div className="space-y-1.5 text-right">
              <p className="text-xl font-black text-blue-400">{orderStatusTracking.shipped.count} <span className="text-xs text-slate-500 font-bold">طلبيات</span></p>
              <p className="text-[10px] text-slate-400">عدد الطرود: {orderStatusTracking.shipped.colis} طرد</p>
              
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة البيع (في الطريق):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.shipped.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة الشراء (تكلفة السلع):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.shipped.buyingCost)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-blue-400 font-bold">الفائدة المتوقعة:</span>
                  <span className="font-black text-blue-400">{formatCurrency(orderStatusTracking.shipped.profit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Status Card */}
          <div className="bg-gradient-to-br from-slate-950/40 to-amber-950/5 p-4 rounded-xl border border-amber-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>قيد الانتظار ⏳</span>
              </span>
              <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                {orderStatusTracking.total.count > 0 ? Math.round((orderStatusTracking.pending.count / orderStatusTracking.total.count) * 100) : 0}%
              </span>
            </div>
            
            <div className="space-y-1.5 text-right">
              <p className="text-xl font-black text-amber-500">{orderStatusTracking.pending.count} <span className="text-xs text-slate-500 font-bold">طلبيات</span></p>
              <p className="text-[10px] text-slate-400">عدد الطرود: {orderStatusTracking.pending.colis} طرد</p>
              
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة البيع (المتوقعة):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.pending.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة الشراء (تكلفة السلع):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.pending.buyingCost)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-amber-400 font-bold">الفائدة التقديرية:</span>
                  <span className="font-black text-amber-400">{formatCurrency(orderStatusTracking.pending.profit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Returned Status Card */}
          <div className="bg-gradient-to-br from-slate-950/40 to-rose-950/5 p-4 rounded-xl border border-rose-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>مسترجع ↩️</span>
              </span>
              <span className="text-[10px] font-mono font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-sm">
                {orderStatusTracking.total.count > 0 ? Math.round((orderStatusTracking.returned.count / orderStatusTracking.total.count) * 100) : 0}%
              </span>
            </div>
            
            <div className="space-y-1.5 text-right">
              <p className="text-xl font-black text-rose-400">{orderStatusTracking.returned.count} <span className="text-xs text-slate-500 font-bold">طلبيات</span></p>
              <p className="text-[10px] text-slate-400">عدد الطرود: {orderStatusTracking.returned.colis} طرد</p>
              
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة البيع الملغاة:</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.returned.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة الشراء المسترجعة:</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.returned.buyingCost)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-rose-400 font-bold">خسائر التغليف والتوصيل:</span>
                  <span className="font-black text-rose-400">-{formatCurrency(Math.abs(orderStatusTracking.returned.profit))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Returned to Supplier Status Card */}
          <div className="bg-gradient-to-br from-slate-950/40 to-purple-950/5 p-4 rounded-xl border border-purple-500/10 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-purple-400 rotate-180" />
                <span>معاد للمورد 🔄</span>
              </span>
              <span className="text-[10px] font-mono font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-sm">
                {orderStatusTracking.total.count > 0 ? Math.round((orderStatusTracking.returnedToSupplier.count / orderStatusTracking.total.count) * 100) : 0}%
              </span>
            </div>
            
            <div className="space-y-1.5 text-right">
              <p className="text-xl font-black text-purple-400">{orderStatusTracking.returnedToSupplier.count} <span className="text-xs text-slate-500 font-bold">طلبيات</span></p>
              <p className="text-[10px] text-slate-400">عدد الطرود: {orderStatusTracking.returnedToSupplier.colis} طرد</p>
              
              <div className="pt-2 border-t border-slate-800/60 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة البيع المعادة:</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.returnedToSupplier.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">قيمة الشراء (المستردة):</span>
                  <span className="font-extrabold text-slate-300">{formatCurrency(orderStatusTracking.returnedToSupplier.buyingCost)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-purple-400 font-bold">خسائر التغليف والتوصيل:</span>
                  <span className="font-black text-rose-400">-{formatCurrency(Math.abs(orderStatusTracking.returnedToSupplier.profit))}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
