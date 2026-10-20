// Pengguna (owner only): add worker accounts, block/unblock, reset passwords.

import { useState } from 'react';
import { LuPlus, LuKeyRound, LuBan, LuCircleCheck } from 'react-icons/lu';
import { t, dateLabel, type Profile } from '@kebun/shared';
import { useStore, useTables, rows, errorText } from '../lib/store';
import { Badge, Button, Card, ConfirmButton, Empty, PageHeader } from '../components/ui';
import { FormModal } from '../components/FormModal';

export default function Users() {
  const s = useTables(['profiles']);
  const [form, setForm] = useState<null | 'add' | { pw: Profile }>(null);
  const users = rows(s, 'profiles');

  const call = async (body: Record<string, unknown>, msg?: string) => {
    try {
      await s.repo.adminUsers(body);
      await s.load(['profiles'], true);
      s.toast(msg ?? t('common.saved'));
    } catch (e) {
      s.toast(errorText(e), 'error');
      throw e;
    }
  };

  if (!s.isOwner) return <Empty />;

  return (
    <div className="narrow-wide">
      <PageHeader title={t('nav.users')} subtitle={t('user.workerCan')}
        actions={<Button icon={<LuPlus />} variant="primary" onClick={() => setForm('add')}>{t('user.add')}</Button>} />
      <Card pad={false}>
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className={u.active ? '' : 'inactive'}>
              <div className="avatar">{(u.full_name || '?').slice(0, 1).toUpperCase()}</div>
              <div className="user-main">
                <b>{u.full_name}</b> {u.id === s.me?.id && <Badge tone="info">anda</Badge>}
                <div className="muted small">@{u.username} · {t('role.' + u.role)}{u.created_at ? ` · ${dateLabel(u.created_at.slice(0, 10), s.lang)}` : ''}</div>
              </div>
              {!u.active && <Badge tone="bad">{t('user.block')}</Badge>}
              {u.id !== s.me?.id && (
                <div className="row-gap">
                  <select className="select select-sm" value={u.role} aria-label={t('user.role')}
                    onChange={(e) => s.update('profiles', u.id, { role: e.target.value as Profile['role'] })}>
                    <option value="worker">{t('role.worker')}</option>
                    <option value="owner">{t('role.owner')}</option>
                  </select>
                  <Button size="sm" variant="ghost" icon={<LuKeyRound />} onClick={() => setForm({ pw: u })}>{t('user.setPassword')}</Button>
                  {u.active
                    ? <ConfirmButton label={t('user.block')} confirmLabel={`${t('user.block')} ${u.full_name}?`} onConfirm={() => call({ action: 'set_active', user_id: u.id, active: false })}><Button size="sm" variant="ghost" icon={<LuBan />}>{t('user.block')}</Button></ConfirmButton>
                    : <Button size="sm" icon={<LuCircleCheck />} onClick={() => call({ action: 'set_active', user_id: u.id, active: true })}>{t('user.unblock')}</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {form === 'add' && (
        <FormModal
          title={t('user.add')}
          initial={{ role: 'worker' }}
          onClose={() => setForm(null)}
          fields={[
            { name: 'full_name', label: t('user.fullName'), required: true },
            { name: 'username', label: t('user.username'), required: true, half: true, placeholder: 'budi', help: 'huruf kecil/angka, tanpa spasi' },
            { name: 'password', label: t('user.password'), type: 'password', required: true, half: true, help: 'min. 6 karakter' },
            { name: 'role', label: t('user.role'), type: 'select', required: true, options: [{ value: 'worker', label: t('role.worker') }, { value: 'owner', label: t('role.owner') }] },
          ]}
          extra={() => <p className="help">{t('user.help')}</p>}
          onSubmit={(v) => call({ action: 'create', ...v })}
        />
      )}
      {form && typeof form === 'object' && (
        <FormModal
          title={`${t('user.setPassword')}: ${form.pw.full_name}`}
          onClose={() => setForm(null)}
          fields={[{ name: 'password', label: t('user.password'), type: 'password', required: true, help: 'min. 6 karakter' }]}
          onSubmit={(v) => call({ action: 'set_password', user_id: form.pw.id, password: v.password })}
        />
      )}
    </div>
  );
}
