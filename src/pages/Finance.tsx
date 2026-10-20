// Keuangan (owner only): sales, expenses, profit per site and per month.

import { useMemo, useState } from 'react';
import { LuPlus, LuDownload } from 'react-icons/lu';
import {
  t, rupiah, dateLabel, num, monthlyTotals, siteTotals, sumBy, today,
  type Sale, type Expense, type ExpenseCategory,
} from '@kebun/shared';
import { useStore, useTables, rows, bySite } from '../lib/store';
import { downloadCSV } from '../lib/csv';
import { Button, Card, Empty, PageHeader, RowActions, Stat, Tabs } from '../components/ui';
import { FormModal } from '../components/FormModal';
import { useOptions } from '../components/forms';
import { MonthBars, HBars } from '../components/charts';

const EXP_CATS: ExpenseCategory[] = ['labor', 'fertilizer', 'pesticide', 'fuel', 'tools', 'transport', 'other'];

function SaleForm({ sale, onClose }: { sale?: Sale; onClose: () => void }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={sale ? t('common.edit') : t('fin.addSale')}
      initial={sale ?? { sale_date: today(), site_id: s.siteId !== 'all' ? s.siteId : '' }}
      onClose={onClose}
      fields={(v) => [
        { name: 'sale_date', label: t('common.date'), type: 'date', required: true, half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, half: true, help: `${t('common.none')} = ${t('fin.shared')}` },
        { name: 'buyer', label: t('fin.buyer'), half: true },
        { name: 'variety_code', label: t('tree.variety'), type: 'select', options: o.varieties, half: true },
        { name: 'weight_kg', label: t('harvest.weight'), type: 'number', min: 0, required: true, half: true, suffix: 'kg' },
        { name: 'price_per_kg', label: t('fin.pricePerKg'), type: 'money', min: 0, required: true, half: true,
          help: v.weight_kg && v.price_per_kg ? `${t('common.total')}: ${rupiah(Number(v.weight_kg) * Number(v.price_per_kg))}` : undefined },
        { name: 'note', label: t('common.note') },
      ]}
      onSubmit={async (v) => {
        if (sale) await s.update('sales', sale.id, v as Partial<Sale>);
        else await s.insert('sales', v as Partial<Sale>);
      }}
    />
  );
}

function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={expense ? t('common.edit') : t('fin.addExpense')}
      initial={expense ?? { expense_date: today(), category: 'labor', site_id: s.siteId !== 'all' ? s.siteId : '' }}
      onClose={onClose}
      fields={[
        { name: 'expense_date', label: t('common.date'), type: 'date', required: true, half: true },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, half: true, help: `${t('common.none')} = ${t('fin.shared')}` },
        { name: 'category', label: t('fin.category'), type: 'select', required: true, half: true, options: EXP_CATS.map((c) => ({ value: c, label: t('exp.' + c) })) },
        { name: 'amount', label: t('common.amount'), type: 'money', min: 0, required: true, half: true },
        { name: 'note', label: t('common.note') },
      ]}
      onSubmit={async (v) => {
        if (expense) await s.update('expenses', expense.id, v as Partial<Expense>);
        else await s.insert('expenses', v as Partial<Expense>);
      }}
    />
  );
}

export default function Finance() {
  const s = useTables(['sites', 'varieties', 'sales', 'expenses', 'harvests', 'supplies']);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales');
  const [form, setForm] = useState<null | 'sale' | 'expense' | Sale | Expense>(null);

  const sites = rows(s, 'sites');
  const allSales = rows(s, 'sales');
  const allExp = rows(s, 'expenses');
  const years = useMemo(() => {
    const ys = new Set([...allSales.map((x) => +x.sale_date.slice(0, 4)), ...allExp.map((x) => +x.expense_date.slice(0, 4)), new Date().getFullYear()]);
    return [...ys].sort((a, b) => b - a);
  }, [allSales, allExp]);

  const sales = bySite(allSales, s.siteId).filter((x) => x.sale_date.startsWith(String(year)));
  const expenses = bySite(allExp, s.siteId).filter((x) => x.expense_date.startsWith(String(year)));
  const income = sumBy(sales, (x) => x.total);
  const spent = sumBy(expenses, (x) => x.amount);
  const profit = income - spent;
  const months = monthlyTotals(sales, expenses, year);
  const perSite = siteTotals(sites, allSales, allExp, rows(s, 'harvests'), year, t('fin.shared'));
  const kgSold = sumBy(sales, (x) => x.weight_kg);
  const perCat = EXP_CATS.map((c) => ({ label: t('exp.' + c), value: sumBy(expenses.filter((e) => e.category === c), (e) => e.amount) })).filter((x) => x.value > 0);
  const siteName = (id: string | null) => sites.find((x) => x.id === id)?.name ?? t('fin.shared');

  if (!s.isOwner) return <Empty>Hanya pemilik yang bisa melihat keuangan.</Empty>;

  return (
    <div>
      <PageHeader
        title={t('nav.finance')}
        actions={<>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button icon={<LuPlus />} onClick={() => setForm('expense')}>{t('fin.addExpense')}</Button>
          <Button icon={<LuPlus />} variant="primary" onClick={() => setForm('sale')}>{t('fin.addSale')}</Button>
        </>}
      />
      <div className="stat-row">
        <Stat label={t('fin.income')} value={rupiah(income)} sub={`${num(kgSold, s.lang, 0)} kg`} />
        <Stat label={t('fin.expense')} value={rupiah(spent)} />
        <Stat label={t('fin.profit')} value={rupiah(profit)} tone={profit >= 0 ? 'good' : 'bad'} sub={income ? `${t('fin.margin')} ${num((profit / income) * 100, s.lang, 0)}%` : undefined} />
      </div>

      <div className="grid-2-1">
        <Card title={t('fin.perMonth')}><MonthBars data={months} lang={s.lang} /></Card>
        <Card title={t('fin.expenses')}>{perCat.length ? <HBars data={perCat} format={(v) => rupiah(v)} tone="expense" /> : <Empty />}</Card>
      </div>

      <Card title={t('fin.perSite')} pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('common.site')}</th><th className="num">{t('nav.harvest')}</th><th className="num">{t('fin.income')}</th><th className="num">{t('fin.expense')}</th><th className="num">{t('fin.profit')}</th></tr></thead>
            <tbody>
              {perSite.map((r) => (
                <tr key={r.site_id ?? 'shared'}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{num(r.harvest_kg, s.lang, 0)} kg</td>
                  <td className="num">{rupiah(r.income)}</td>
                  <td className="num">{rupiah(r.expense)}</td>
                  <td className={`num ${r.profit >= 0 ? 'good-text' : 'bad-text'}`}><b>{rupiah(r.profit)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card pad={false} title={<Tabs value={tab} onChange={setTab} items={[{ value: 'sales', label: t('fin.sales') }, { value: 'expenses', label: t('fin.expenses') }]} />}
        actions={<Button size="sm" variant="ghost" icon={<LuDownload />} onClick={() => tab === 'sales'
          ? downloadCSV(`penjualan-${year}.csv`, sales.map((x) => ({ date: x.sale_date, site: siteName(x.site_id), buyer: x.buyer, variety: x.variety_code, kg: x.weight_kg, price_per_kg: x.price_per_kg, total: x.total, note: x.note })))
          : downloadCSV(`pengeluaran-${year}.csv`, expenses.map((x) => ({ date: x.expense_date, site: siteName(x.site_id), category: t('exp.' + x.category), amount: x.amount, note: x.note })))}>{t('common.export')}</Button>}>
        <div className="table-wrap">
          {tab === 'sales' ? (
            sales.length === 0 ? <Empty /> : (
              <table className="table">
                <thead><tr><th>{t('common.date')}</th><th>{t('common.site')}</th><th>{t('fin.buyer')}</th><th>{t('tree.variety')}</th><th className="num">kg</th><th className="num">{t('fin.pricePerKg')}</th><th className="num">{t('common.total')}</th><th /></tr></thead>
                <tbody>
                  {sales.map((x) => (
                    <tr key={x.id}>
                      <td>{dateLabel(x.sale_date, s.lang)}</td><td>{siteName(x.site_id)}</td><td>{x.buyer}</td><td>{x.variety_code ?? '–'}</td>
                      <td className="num">{num(x.weight_kg, s.lang)}</td><td className="num">{rupiah(x.price_per_kg)}</td><td className="num"><b>{rupiah(x.total)}</b></td>
                      <td><RowActions onEdit={() => setForm(x)} onDelete={() => s.remove('sales', x.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            expenses.length === 0 ? <Empty /> : (
              <table className="table">
                <thead><tr><th>{t('common.date')}</th><th>{t('common.site')}</th><th>{t('fin.category')}</th><th>{t('common.note')}</th><th className="num">{t('common.amount')}</th><th /></tr></thead>
                <tbody>
                  {expenses.map((x) => (
                    <tr key={x.id}>
                      <td>{dateLabel(x.expense_date, s.lang)}</td><td>{siteName(x.site_id)}</td><td>{t('exp.' + x.category)}</td><td>{x.note}</td>
                      <td className="num"><b>{rupiah(x.amount)}</b></td>
                      <td><RowActions onEdit={() => setForm(x)} onDelete={() => s.remove('expenses', x.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </Card>

      {form === 'sale' && <SaleForm onClose={() => setForm(null)} />}
      {form === 'expense' && <ExpenseForm onClose={() => setForm(null)} />}
      {form && typeof form === 'object' && ('sale_date' in form
        ? <SaleForm sale={form as Sale} onClose={() => setForm(null)} />
        : <ExpenseForm expense={form as Expense} onClose={() => setForm(null)} />)}
    </div>
  );
}
