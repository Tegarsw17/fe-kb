// Stok: fertilizer / pesticide / fungicide with low-stock alerts, purchases,
// corrections and history. Usage is subtracted automatically from activities.

import { useState } from 'react';
import { LuPlus, LuShoppingBasket, LuScale, LuHistory } from 'react-icons/lu';
import { t, qty, rupiah, dateLabel, isLowStock, today, type Supply } from '@kebun/shared';
import { useStore, useTables, rows } from '../lib/store';
import { Badge, Button, Card, Empty, Meter, Modal, PageHeader, RowActions, Tabs } from '../components/ui';
import { FormModal } from '../components/FormModal';
import { useOptions } from '../components/forms';

const CATS = ['fertilizer', 'pesticide', 'fungicide', 'other'] as const;
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs'];

function SupplyForm({ supply, onClose }: { supply?: Supply; onClose: () => void }) {
  const s = useStore();
  return (
    <FormModal
      title={supply ? `${t('common.edit')}: ${supply.name}` : t('stock.add')}
      initial={supply ?? { category: 'fertilizer', unit: 'kg', min_stock: 0, price_per_unit: 0 }}
      onClose={onClose}
      fields={[
        { name: 'name', label: t('common.name'), required: true, placeholder: 'NPK 16-16-16' },
        { name: 'category', label: t('stock.category'), type: 'select', required: true, half: true, options: CATS.map((c) => ({ value: c, label: t('cat.' + c) })) },
        { name: 'unit', label: t('stock.unit'), type: 'select', required: true, half: true, options: UNITS.map((u) => ({ value: u, label: u === 'l' ? 'L' : u })) },
        { name: 'initial', label: t('stock.current'), type: 'number', min: 0, half: true, show: () => !supply },
        { name: 'min_stock', label: t('stock.min'), type: 'number', min: 0, half: true, help: 'Muncul peringatan jika stok ≤ angka ini' },
        { name: 'price_per_unit', label: t('stock.price'), type: 'money', min: 0, half: true },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      onSubmit={async (v) => {
        const { initial, ...vals } = v;
        if (supply) await s.update('supplies', supply.id, vals as Partial<Supply>);
        else {
          const row = await s.insert('supplies', vals as Partial<Supply>, false);
          if (Number(initial) > 0) await s.insert('supply_movements', { supply_id: row.id, qty: Number(initial), reason: 'adjust', note: 'Stok awal' }, false);
          s.toast(t('common.saved'));
        }
      }}
    />
  );
}

function BuyForm({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const s = useStore();
  const o = useOptions();
  return (
    <FormModal
      title={`${t('stock.buy')}: ${supply.name}`}
      initial={{ qty: '', price_per_unit: supply.price_per_unit || '', record: true, expense_date: today(), site_id: '' }}
      onClose={onClose}
      fields={(v) => [
        { name: 'qty', label: t('stock.qty'), type: 'number', min: 0, required: true, half: true, suffix: supply.unit },
        { name: 'price_per_unit', label: t('stock.price'), type: 'money', min: 0, half: true },
        { name: 'record', label: `${t('stock.recordExpense')}${v.qty && v.price_per_unit ? ` (${rupiah(Number(v.qty) * Number(v.price_per_unit))})` : ''}`, type: 'checkbox' },
        { name: 'expense_date', label: t('common.date'), type: 'date', half: true, show: (x) => !!x.record },
        { name: 'site_id', label: t('common.site'), type: 'select', options: o.sites, half: true, show: (x) => !!x.record, help: `${t('common.none')} = ${t('fin.shared')}` },
        { name: 'note', label: t('common.note') },
      ]}
      onSubmit={async (v) => {
        await s.insert('supply_movements', { supply_id: supply.id, qty: Number(v.qty), reason: 'purchase', note: v.note ?? '' }, false);
        if (v.price_per_unit && Number(v.price_per_unit) !== supply.price_per_unit) await s.update('supplies', supply.id, { price_per_unit: Number(v.price_per_unit) }, false);
        if (v.record && v.price_per_unit) {
          await s.insert('expenses', {
            expense_date: v.expense_date || today(), site_id: v.site_id || null,
            category: supply.category === 'fertilizer' ? 'fertilizer' : supply.category === 'other' ? 'other' : 'pesticide',
            amount: Number(v.qty) * Number(v.price_per_unit), note: `${supply.name} ${qty(Number(v.qty), supply.unit)}`, supply_id: supply.id,
          }, false);
        }
        s.toast(t('common.saved'));
      }}
    />
  );
}

function AdjustForm({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const s = useStore();
  return (
    <FormModal
      title={`${t('stock.adjust')}: ${supply.name}`}
      initial={{ actual: supply.stock }}
      onClose={onClose}
      fields={[
        { name: 'actual', label: t('stock.newStock'), type: 'number', min: 0, required: true, suffix: supply.unit, help: `${t('stock.current')}: ${qty(supply.stock, supply.unit, s.lang)}` },
        { name: 'note', label: t('common.note'), placeholder: 'mis. hitung ulang gudang' },
      ]}
      onSubmit={async (v) => {
        const diff = Math.round((Number(v.actual) - Number(supply.stock)) * 1000) / 1000;
        if (diff !== 0) await s.insert('supply_movements', { supply_id: supply.id, qty: diff, reason: 'adjust', note: v.note ?? '' });
      }}
    />
  );
}

export default function Stock() {
  const s = useTables(['supplies', 'sites', ...(['supply_movements', 'profiles'] as const)]);
  const [cat, setCat] = useState<'all' | typeof CATS[number]>('all');
  const [form, setForm] = useState<null | { kind: 'add' | 'edit' | 'buy' | 'adjust' | 'history'; supply?: Supply }>(null);
  const supplies = rows(s, 'supplies').filter((x) => cat === 'all' || x.category === cat)
    .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || a.name.localeCompare(b.name));
  const movements = rows(s, 'supply_movements');
  const profiles = rows(s, 'profiles');
  const value = supplies.reduce((a, x) => a + Number(x.stock) * Number(x.price_per_unit), 0);

  return (
    <div>
      <PageHeader
        title={t('nav.stock')}
        subtitle={s.isOwner ? `${supplies.length} bahan · nilai stok ${rupiah(value)}` : undefined}
        actions={s.isOwner && <Button icon={<LuPlus />} variant="primary" onClick={() => setForm({ kind: 'add' })}>{t('stock.add')}</Button>}
      />
      <Tabs value={cat} onChange={setCat} items={[{ value: 'all', label: t('common.all') }, ...CATS.map((c) => ({ value: c, label: t('cat.' + c) }))]} />
      {supplies.length === 0 ? <Card><Empty /></Card> : (
        <div className="supply-grid">
          {supplies.map((x) => {
            const low = isLowStock(x);
            const tone = Number(x.stock) <= Number(x.min_stock) / 2 ? 'bad' : low ? 'warn' : 'good';
            return (
              <Card key={x.id} className={`supply ${low ? 'is-low' : ''}`}>
                <div className="row-between">
                  <div>
                    <h3 className="supply-name">{x.name}</h3>
                    <span className="muted small">{t('cat.' + x.category)}{x.price_per_unit ? ` · ${rupiah(x.price_per_unit)}/${x.unit === 'l' ? 'L' : x.unit}` : ''}</span>
                  </div>
                  <Badge tone={low ? (tone === 'bad' ? 'bad' : 'warn') : 'good'}>{low ? t('stock.low') : t('stock.ok')}</Badge>
                </div>
                <div className="supply-qty">{qty(x.stock, x.unit, s.lang)}</div>
                <Meter value={Number(x.stock)} max={Math.max(Number(x.min_stock) * 3, Number(x.stock))} tone={tone} />
                <div className="muted small">{t('stock.min')}: {qty(x.min_stock, x.unit, s.lang)}</div>
                {x.notes && <p className="small">{x.notes}</p>}
                {s.isOwner && (
                  <div className="supply-actions">
                    <Button size="sm" variant={low ? 'primary' : 'soft'} icon={<LuShoppingBasket />} onClick={() => setForm({ kind: 'buy', supply: x })}>{t('stock.buy')}</Button>
                    <Button size="sm" variant="ghost" icon={<LuScale />} onClick={() => setForm({ kind: 'adjust', supply: x })}>{t('stock.adjust')}</Button>
                    <Button size="sm" variant="ghost" icon={<LuHistory />} onClick={() => setForm({ kind: 'history', supply: x })}>{t('stock.movements')}</Button>
                    <RowActions onEdit={() => setForm({ kind: 'edit', supply: x })} onDelete={() => s.remove('supplies', x.id)} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {form?.kind === 'add' && <SupplyForm onClose={() => setForm(null)} />}
      {form?.kind === 'edit' && <SupplyForm supply={form.supply} onClose={() => setForm(null)} />}
      {form?.kind === 'buy' && <BuyForm supply={form.supply!} onClose={() => setForm(null)} />}
      {form?.kind === 'adjust' && <AdjustForm supply={form.supply!} onClose={() => setForm(null)} />}
      {form?.kind === 'history' && (
        <Modal title={`${t('stock.movements')}: ${form.supply!.name}`} onClose={() => setForm(null)} wide>
          <table className="table">
            <thead><tr><th>{t('common.date')}</th><th>{t('common.type')}</th><th className="num">{t('stock.qty')}</th><th>{t('common.by')}</th><th>{t('common.note')}</th></tr></thead>
            <tbody>
              {movements.filter((m) => m.supply_id === form.supply!.id).map((m) => (
                <tr key={m.id}>
                  <td>{dateLabel(m.created_at.slice(0, 10), s.lang)}</td>
                  <td>{t('reason.' + m.reason)}</td>
                  <td className={`num ${m.qty < 0 ? 'bad-text' : 'good-text'}`}>{m.qty > 0 ? '+' : ''}{qty(m.qty, form.supply!.unit, s.lang)}</td>
                  <td>{profiles.find((p) => p.id === m.created_by)?.full_name ?? ''}</td>
                  <td>{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
