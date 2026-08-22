import { useMemo, useState } from 'react';
import { Product, Sale, Expense, formatCurrency } from '../types';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  ChevronRight, 
  ArrowUpRight, 
  ShoppingCart,
  Calendar,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  BookOpen
} from 'lucide-react';

// Helper to get YYYY-MM-DD format in the user's local timezone
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  expenses?: Expense[];
  packagingPrice?: number;
  onNavigateToStock: () => void;
  onNavigateToSales: () => void;
  onViewReceipt: (sale: Sale) => void;
}

export default function Dashboard({ 
  products, 
  sales, 
  expenses = [],
  packagingPrice = 100,
  onNavigateToStock, 
  onNavigateToSales,
  onViewReceipt 
}: DashboardProps) {
  const [showFinancialGuide, setShowFinancialGuide] = useState(false);

  // 1. Calculate Key Metrics
  const metrics = useMemo(() => {
    // Total stock valuation based on buying prices
    const totalStockValue = products.reduce((acc, p) => acc + (p.buyingPrice * p.quantity), 0);
    const totalPotentialRevenue = products.reduce((acc, p) => acc + (p.sellingPrice * p.quantity), 0);
    
    // Today's date string matching (YYYY-MM-DD)
    const todayStr = getLocalDateString(new Date());
    
    // Today's sales
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.date);
      return getLocalDateString(saleDate) === todayStr;
    });
    const totalSalesToday = todaySales.reduce((acc, s) => acc + s.totalPrice, 0);

    // Total actual profit (Revenue - Buying Cost) from delivered sales history only (الربح عند التوصيل)
    const totalProfit = sales.reduce((acc, s) => {
      if (s.status !== 'delivered') {
        return acc;
      }
      
      if (s.items && s.items.length > 0) {
        const cost = s.items.reduce((sum, item) => {
          if (item.sellType === 'carton') {
            // For carton sales: cartonsQuantity is the actual carton count.
            // item.buyingPriceAtSale is the carton buying price.
            const cartonsQty = item.cartonsQuantity || 0;
            return sum + (cartonsQty * item.buyingPriceAtSale);
          } else {
            // For single pairs: pairsQuantity is the pair count, fallback to item.quantity.
            // item.buyingPriceAtSale is the single pair buying price.
            const pairsQty = item.pairsQuantity || item.quantity;
            return sum + (pairsQty * item.buyingPriceAtSale);
          }
        }, 0);
        return acc + (s.totalPrice - cost);
      } else {
        const cost = s.buyingPriceAtSale * s.quantity;
        return acc + (s.totalPrice - cost);
      }
    }, 0);

    // General expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Packaging cost based on user configured price
    const totalParcels = sales.reduce((sum, s) => sum + (s.customerColis || 0), 0);
    const totalPackagingCost = totalParcels * packagingPrice;

    // Delivery payments commission (manual sum)
    let totalDeliveryCommission = 0;
    let receivedFromDelivery = 0;
    try {
      const saved = localStorage.getItem('delivery_payments_history');
      if (saved) {
        const deliveryPayments = JSON.parse(saved);
        if (Array.isArray(deliveryPayments)) {
          receivedFromDelivery = deliveryPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          totalDeliveryCommission = deliveryPayments.reduce((sum: number, p: any) => sum + (p.commission ?? 0), 0);
        }
      }
    } catch (e) {
      console.error('Failed to parse delivery payments for dashboard metrics:', e);
    }

    // Net Profit
    const netProfit = totalProfit - totalExpenses - totalPackagingCost - totalDeliveryCommission;

    // All time delivered revenue
    const allTimeDeliveredRevenue = sales
      .filter(s => s.status === 'delivered')
      .reduce((sum, s) => sum + s.totalPrice, 0);

    // Remaining with delivery company
    const receivedFromDeliveryTotalSettled = receivedFromDelivery + totalDeliveryCommission;
    const remainingWithDelivery = Math.max(0, allTimeDeliveredRevenue - receivedFromDeliveryTotalSettled);

    // Supplier payments (actual cash spent on inventory)
    let totalPaidToSupplier = 0;
    try {
      const savedSupplier = localStorage.getItem('supplier_payments_history');
      if (savedSupplier) {
        const supplierPayments = JSON.parse(savedSupplier);
        if (Array.isArray(supplierPayments)) {
          totalPaidToSupplier = supplierPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        }
      } else {
        const oldSaved = localStorage.getItem('supplier_paid_amount');
        if (oldSaved) {
          totalPaidToSupplier = Number(oldSaved) || 0;
        }
      }
    } catch (e) {
      console.error('Failed to parse supplier payments for dashboard metrics:', e);
    }

    // Current cash actually in hand (السيولة الفعلية في الجيب)
    // Formula: receivedFromDelivery - totalExpenses - totalPackagingCost - totalPaidToSupplier
    const currentNetProfit = receivedFromDelivery - totalExpenses - totalPackagingCost - totalPaidToSupplier;

    // Low stock items (quantity < 5, but > 0)
    const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity < 5).length;
    // Out of stock items (quantity === 0)
    const outOfStockCount = products.filter(p => p.quantity === 0).length;

    return {
      totalStockValue,
      totalPotentialRevenue,
      totalSalesToday,
      todaySalesCount: todaySales.length,
      totalProfit,
      netProfit,
      currentNetProfit,
      receivedFromDelivery,
      remainingWithDelivery,
      totalExpenses,
      totalPackagingCost,
      totalDeliveryCommission,
      totalPaidToSupplier,
      lowStockCount,
      outOfStockCount,
    };
  }, [products, sales, expenses, packagingPrice]);

  // 2. Generate 7-day Sales Trend Data
  const weeklyTrend = useMemo(() => {
    const days = [];
    const locale = 'ar-DZ';
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      
      const label = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
      
      const daySales = sales.filter(s => {
        const saleDate = new Date(s.date);
        return getLocalDateString(saleDate) === dateStr;
      });
      const amount = daySales.reduce((acc, s) => acc + s.totalPrice, 0);
      const volume = daySales.reduce((acc, s) => {
        if (s.items && s.items.length > 0) {
          return acc + s.items.reduce((sum, item) => sum + item.quantity, 0);
        }
        return acc + s.quantity;
      }, 0);
      
      days.push({
        dateStr,
        label,
        amount,
        volume
      });
    }

    const maxAmount = Math.max(...days.map(d => d.amount), 100); // Avoid divide by 0

    return {
      days,
      maxAmount
    };
  }, [sales]);

  // 3. Recent Sales Activity Feed (Last 5 sales)
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [sales]);

  return (
    <div id="dashboard-section" className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">مرحباً، محمد</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">إليك الحالة العامة والنشاط اليومي لمتجرك.</p>
        </div>
        <div className="grid grid-cols-2 md:flex gap-2.5 w-full md:w-auto">
          <button 
            id="btn-quick-new-sale"
            onClick={onNavigateToSales}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl transition duration-200 shadow-lg shadow-emerald-900/20 text-xs sm:text-sm h-11 sm:h-12 cursor-pointer w-full"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>بيع جديد</span>
          </button>
          <button 
            id="btn-quick-add-product"
            onClick={onNavigateToStock}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition duration-200 text-xs sm:text-sm h-11 sm:h-12 cursor-pointer w-full"
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>إدارة المخزون</span>
          </button>
        </div>
      </div>

      {/* Key Stats Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Metric Card: Valeur du Stock */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between min-h-[115px] sm:min-h-[140px]"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-sm font-semibold text-slate-400 truncate">قيمة المخزون</span>
            <div className="p-1.5 sm:p-2.5 bg-indigo-500/10 rounded-lg sm:rounded-xl text-indigo-400 shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <span className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-100 block truncate">
              {formatCurrency(metrics.totalStockValue)}
            </span>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 truncate">
              <span className="shrink-0">المحتملة:</span>
              <span className="font-semibold text-indigo-400 truncate">
                {formatCurrency(metrics.totalPotentialRevenue)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Metric Card: Ventes d'aujourd'hui */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between min-h-[115px] sm:min-h-[140px]"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-sm font-semibold text-slate-400 truncate">مبيعات اليوم</span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 rounded-lg sm:rounded-xl text-emerald-400 shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <span className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-100 block truncate">
              {formatCurrency(metrics.totalSalesToday)}
            </span>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center gap-1.5 truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate">{metrics.todaySalesCount} عمليات</span>
            </div>
          </div>
        </motion.div>

        {/* Metric Card: أرباح السلع الموصلة */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between min-h-[115px] sm:min-h-[140px]"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-sm font-semibold text-slate-400 truncate flex items-center gap-1">
              <span>أرباح السلع الموصلة</span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:inline" title="مجموع (سعر البيع - سعر الشراء) للطلبات التي استلمها الزبائن بالفعل" />
            </span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 rounded-lg sm:rounded-xl text-emerald-400 font-bold shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <span className={`text-base sm:text-xl md:text-2xl font-extrabold block truncate ${metrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(metrics.totalProfit)}
            </span>
            <div className="text-[9px] text-slate-400 mt-1 space-y-0.5 font-medium truncate">
              <p className="text-slate-500 text-[8.5px] truncate">الأرباح قبل خصم المصاريف والتغليف 📦</p>
              <p className="text-[8.5px] text-emerald-500/80 font-bold truncate">سعر البيع - الشراء فقط 🚚</p>
            </div>
          </div>
        </motion.div>

        {/* Metric Card: Net Profit Card */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-800/80 shadow-xl flex flex-col justify-between min-h-[115px] sm:min-h-[140px]"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-sm font-bold text-slate-400 truncate flex items-center gap-1">
              <span>صافي الأرباح الكلي</span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:inline" title="الأرباح المتبقية بعد طرح المصاريف، أكياس التغليف، وعمولات التوصيل" />
            </span>
            <div className="p-1.5 sm:p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-base sm:text-lg md:text-xl font-bold block truncate ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(metrics.netProfit)}
            </span>
            <div className="text-[9px] text-slate-400 mt-1 space-y-0.5 font-medium truncate">
              <p>المصاريف: <span className="text-rose-400 font-bold">{formatCurrency(metrics.totalExpenses)}</span></p>
              <p>التغليف: <span className="text-orange-400 font-bold">{formatCurrency(metrics.totalPackagingCost)}</span></p>
              <p>العمولة: <span className="text-rose-400 font-bold">{formatCurrency(metrics.totalDeliveryCommission)}</span></p>
            </div>
          </div>
        </motion.div>

        {/* Metric Card: Realized Net Profit (Actual Cash In Hand / After Withdrawals) */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border-2 border-emerald-500/50 shadow-emerald-900/10 shadow-2xl flex flex-col justify-between min-h-[115px] sm:min-h-[140px] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 bg-emerald-600 text-[8px] sm:text-[9px] text-white font-black px-2 py-0.5 rounded-br-lg uppercase tracking-wider">
            السيولة المتوفرة (الكاش)
          </div>
          <div className="flex items-center justify-between gap-1 mt-2">
            <span className="text-[11px] sm:text-sm font-black text-emerald-400 truncate flex items-center gap-1">
              <span>الرصيد الفعلي في الجيب</span>
              <HelpCircle className="w-3.5 h-3.5 text-emerald-300 shrink-0 hidden sm:inline" title="رصيد الصندوق الفعلي: المبالغ التي سحبتها من شركة التوصيل مطروحاً منها المصاريف والتغليف والمدفوعات الفعلية للمورد" />
            </span>
            <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg text-emerald-300 font-black shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-base sm:text-lg md:text-xl font-black block truncate ${metrics.currentNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(metrics.currentNetProfit)}
            </span>
            <div className="text-[9px] text-slate-400 mt-1 space-y-0.5 font-medium truncate">
              <p>السيولة المستلمة: <span className="text-emerald-400 font-bold">{formatCurrency(metrics.receivedFromDelivery)}</span></p>
              <p>المدفوع للمورد: <span className="text-purple-400 font-bold">{formatCurrency(metrics.totalPaidToSupplier)}</span></p>
              <p>المصاريف والتغليف: <span className="text-rose-400 font-bold">{formatCurrency(metrics.totalExpenses + metrics.totalPackagingCost)}</span></p>
            </div>
          </div>
        </motion.div>

        {/* Metric Card: Alertes de Stock */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={onNavigateToStock}
          className="bg-slate-900 p-3.5 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between cursor-pointer group min-h-[115px] sm:min-h-[140px]"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-sm font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors truncate">تنبيهات المخزون</span>
            <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${metrics.outOfStockCount > 0 ? 'bg-rose-500/10 text-rose-400' : metrics.lowStockCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-4">
            <div className="flex items-baseline gap-1 truncate">
              <span className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-100">{metrics.lowStockCount + metrics.outOfStockCount}</span>
              <span className="text-[10px] sm:text-xs text-slate-400 truncate">سلع حرجة</span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex gap-1.5 truncate">
              {metrics.outOfStockCount > 0 && <span className="text-rose-400 font-medium shrink-0">{metrics.outOfStockCount} نافذ</span>}
              {metrics.lowStockCount > 0 && <span className="text-amber-400 font-medium shrink-0">{metrics.lowStockCount} منخفض</span>}
              {metrics.lowStockCount + metrics.outOfStockCount === 0 && <span className="text-emerald-400 font-medium shrink-0">ممتاز ✓</span>}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Financial Guide Accordion to explain metrics and remove confusion */}
      <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl">
        <button
          onClick={() => setShowFinancialGuide(!showFinancialGuide)}
          className="w-full flex items-center justify-between text-right text-slate-200 hover:text-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20 transition-all shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="text-right">
              <h4 className="text-xs sm:text-sm font-bold text-slate-200">💡 هل تشعر بتداخل أو خلط في أرقام الأرباح؟ اضغط هنا لفهم طريقة الحساب بالتفصيل</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">شرح تفصيلي مبسط للعلاقة بين أرباح السلع، الربح الصافي، والسيولة الفعلية في جيبك</p>
            </div>
          </div>
          <div className="text-slate-400 group-hover:text-slate-200 transition-colors shrink-0 mr-2">
            {showFinancialGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showFinancialGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-slate-800/60 space-y-4 text-xs leading-relaxed text-slate-300 text-right"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/55 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold justify-start flex-row-reverse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>1. أرباح السلع الموصلة (إجمالي)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed text-right">
                  هذا هو <strong>الربح الخام للمبيعات الموصلة بالفعل</strong>. يمثل سعر بيع المنتج للزبون مطروحاً منه سعر شرائه الأصلي من المورد. لا نخصم منه هنا أي مصاريف إضافية.
                </p>
                <div className="pt-2 border-t border-slate-800/40 text-[10px] text-slate-400 font-mono text-right">
                  الحساب: <span className="text-emerald-400">سعر البيع - تكلفة الشراء للسلع الموصلة</span>
                </div>
              </div>

              <div className="bg-slate-900/55 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold justify-start flex-row-reverse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>2. صافي الأرباح الكلي للنشاط</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed text-right">
                  هذا يمثل <strong>الربح الحقيقي الصافي لمشروعك بأكمله</strong>. نأخذ فيه بعين الاعتبار جميع المصاريف الجانبية التي دفعتها من جيبك للتغليف والعمل والعمولات والمصاريف العامة.
                </p>
                <div className="pt-2 border-t border-slate-800/40 text-[10px] text-slate-400 font-mono text-right">
                  الحساب: <span className="text-indigo-400">أرباح السلع - المصاريف - التغليف - العمولات</span>
                </div>
              </div>

              <div className="bg-slate-900/55 p-3.5 rounded-xl border border-emerald-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold justify-start flex-row-reverse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>3. الرصيد الفعلي في الجيب</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed text-right">
                  هذا يمثل <strong>السيولة النقدية المتوفرة حالياً في صندوقك (الكاش الفعلي)</strong>. يتم حسابه بطرح جميع المصاريف التشغيلية والمدفوعات التي سلمتها للمورد من إجمالي المبالغ التي قمت بسحبها بالفعل من شركة التوصيل.
                </p>
                <div className="pt-2 border-t border-slate-800/40 text-[10px] text-slate-400 font-mono text-right">
                  الحساب: <span className="text-emerald-300">السيولة المستلمة - المصاريف - التغليف - المبالغ المدفوعة للمورد</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2 text-right">
              <Info className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <strong>مثال عملي مبسط:</strong> إذا بلغت المبالغ التي قمت بسحبها من شركة التوصيل 15,000 دج، ودفعت للمورد 8,000 دج لشراء السلع، ومصاريف الإعلانات والمحل 1,200 دج، وتغليف الطرود 300 دج.
                فإن <strong>الرصيد الفعلي في جيبك حالياً</strong> هو 5,500 دج كاش متوفرة كسيولة حقيقية.
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Charts & Weekly Trends (8 columns on large screen) */}
        <div className="lg:col-span-8 bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">منحنى المبيعات الأسبوعي</h3>
              <p className="text-xs text-slate-400">مبيعات آخر 7 أيام</p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              السجل الحديث
            </span>
          </div>

          {/* Interactive CSS Bar Chart */}
          <div className="pt-4 overflow-x-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-800 pb-1">
            <div className="flex items-end justify-between h-48 sm:h-56 min-w-[420px] sm:min-w-0 gap-1.5 sm:gap-4 border-b border-slate-800 pb-2">
              {weeklyTrend.days.map((day, idx) => {
                const percentage = (day.amount / weeklyTrend.maxAmount) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none transition-all duration-200">
                      <div className="bg-slate-950 text-slate-100 text-[11px] font-bold rounded-lg px-2.5 py-1.5 shadow-xl border border-slate-800 whitespace-nowrap">
                        <p className="text-emerald-400">{formatCurrency(day.amount)}</p>
                        <p className="text-slate-400 text-[9px] font-normal text-center">{day.volume} وحدة مباعة</p>
                      </div>
                      <div className="w-1.5 h-1.5 bg-slate-950 border-l border-b border-slate-800 rotate-45 -mt-1"></div>
                    </div>

                    {/* Chart Column Pillar */}
                    <div className="w-full max-w-[40px] bg-slate-800/50 rounded-t-lg h-full flex items-end overflow-hidden">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${percentage}%` }}
                        transition={{ delay: idx * 0.05, duration: 0.6, ease: 'easeOut' }}
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          day.amount > 0 
                            ? 'bg-gradient-to-t from-indigo-600 to-emerald-400 group-hover:from-indigo-500 group-hover:to-emerald-300' 
                            : 'bg-transparent'
                        }`}
                      />
                    </div>

                    {/* Day label */}
                    <span className="text-[10px] sm:text-xs text-slate-400 mt-2 font-medium capitalize truncate w-full text-center">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend info */}
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 mt-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-gradient-to-tr from-indigo-600 to-emerald-400"></span>
                  المبيعات (د.ج)
                </span>
              </div>
              <span>اضغط أو مرر لمشاهدة التفاصيل</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions Feed (4 columns on large screen) */}
        <div className="lg:col-span-4 bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">أحدث العمليات</h3>
              <button 
                id="btn-navigate-sales-all"
                onClick={onNavigateToSales}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 group cursor-pointer"
              >
                عرض الكل
                <ChevronRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* List of Recent Sales */}
            <div className="divide-y divide-slate-800 max-h-[290px] overflow-y-auto pr-1">
              {recentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 bg-slate-800 text-slate-500 rounded-full mb-3">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">لا توجد مبيعات مسجلة</p>
                  <p className="text-xs text-slate-500 mt-1">سجل أول عملية بيع لتبدأ.</p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="py-3 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 font-bold">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{sale.productName}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(sale.date).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })} • {sale.quantity} وحدة
                        </p>
                      </div>
                    </div>
                    <div className="text-left flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-slate-100">
                        {formatCurrency(sale.totalPrice)}
                      </span>
                      <button 
                        onClick={() => onViewReceipt(sale)}
                        className="text-[10px] font-medium text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                      >
                        الوصل
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="bg-slate-950 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400 border border-slate-800/80">
              <span>المنتجات المسجلة: <strong className="text-slate-200">{products.length}</strong></span>
              <span>المبيعات المتراكمة: <strong className="text-slate-200">{sales.length}</strong></span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

