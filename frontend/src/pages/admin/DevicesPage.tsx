import { useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, Plus, Wifi, WifiOff } from 'lucide-react'
import { admin } from '@/api/client'
import type { AdminDevice, DeviceLogin } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { ConfirmDialog, Modal } from '@/components/Modal'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatDateTime, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

/** Address of a Shelly in access-point mode, which is how a new device is first reached. */
const SHELLY_AP_ADDRESS = '192.168.33.1'

export function DevicesPage() {
  const { t, locale } = useT()
  const devices = useAsync(() => admin.devices())
  const [addOpen, setAddOpen] = useState(false)
  const [login, setLogin] = useState<DeviceLogin | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'rotate' | 'remove'; deviceId: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const issue = async (deviceId: string) => {
    setBusy(deviceId)
    setError(null)
    try {
      setLogin(await admin.issueDeviceLogin(deviceId))
      await devices.reload()
    } catch (e) {
      setError(errorMessage(e, t('networkError')))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (deviceId: string) => {
    setBusy(deviceId)
    setError(null)
    try {
      await admin.revokeDeviceLogin(deviceId)
      await devices.reload()
    } catch (e) {
      setError(errorMessage(e, t('networkError')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title={t('devices')}>
        <Button variant="cta" icon={<Plus size={18} />} onClick={() => setAddOpen(true)}>
          {t('addDevice')}
        </Button>
      </PageHeader>
      {devices.error && <Alert tone="error" className="mb-4">{devices.error}</Alert>}
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {devices.loading && !devices.data ? (
        <PageSpinner />
      ) : !devices.data?.length ? (
        <Alert tone="info">{t('noDevices')}</Alert>
      ) : (
        <div className="grid gap-1">
          {devices.data.map((d) => (
            <DeviceRow
              key={d.deviceId}
              device={d}
              busy={busy === d.deviceId}
              issuedText={d.loginIssuedAt ? t('loginSince', { date: formatDateTime(d.loginIssuedAt, locale) }) : t('noLogin')}
              onIssue={() => (d.loginIssuedAt ? setConfirm({ kind: 'rotate', deviceId: d.deviceId }) : void issue(d.deviceId))}
              onRemove={() => setConfirm({ kind: 'remove', deviceId: d.deviceId })}
            />
          ))}
        </div>
      )}

      <AddDeviceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onIssued={async (l) => {
          setAddOpen(false)
          setLogin(l)
          await devices.reload()
        }}
      />
      <LoginModal login={login} onClose={() => setLogin(null)} />
      <ConfirmDialog
        open={confirm?.kind === 'rotate'}
        title={t('newPassword')}
        message={t('newPasswordConfirm', { id: confirm?.deviceId ?? '' })}
        confirmLabel={t('newPassword')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm!.deviceId
          setConfirm(null)
          void issue(id)
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        title={t('removeLogin')}
        message={t('removeLoginConfirm', { id: confirm?.deviceId ?? '' })}
        confirmLabel={t('removeLogin')}
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm!.deviceId
          setConfirm(null)
          void remove(id)
        }}
      />
    </div>
  )
}

function DeviceRow({
  device: d,
  busy,
  issuedText,
  onIssue,
  onRemove,
}: {
  device: AdminDevice
  busy: boolean
  issuedText: string
  onIssue: () => void
  onRemove: () => void
}) {
  const { t } = useT()
  return (
    <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className={`grid place-items-center h-11 w-11 shrink-0 ${d.online ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
        {d.online ? <Wifi size={20} /> : <WifiOff size={20} />}
      </span>
      <div className="flex-1 min-w-48">
        <div className="font-semibold text-[17px] break-all">{d.deviceId}</div>
        <div className="text-[15px] text-ink-3">
          {t('linkedLockers')}: {d.lockers.length ? d.lockers.map((l) => `${l.siteName} ${l.label}`).join(', ') : '–'}
        </div>
        <div className={`text-[15px] ${d.loginIssuedAt ? 'text-ink-3' : 'text-warn-700 font-semibold'}`}>{issuedText}</div>
      </div>
      <Badge tone={d.online ? 'green' : 'red'}>{d.online ? t('online') : t('offline')}</Badge>
      <div className="flex gap-2">
        <Button size="sm" variant={d.loginIssuedAt ? 'secondary' : 'cta'} icon={<KeyRound size={16} />} loading={busy} onClick={onIssue}>
          {d.loginIssuedAt ? t('newPassword') : t('createLogin')}
        </Button>
        {d.loginIssuedAt && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
            {t('removeLogin')}
          </Button>
        )}
      </div>
    </Card>
  )
}

function AddDeviceModal({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: (l: DeviceLogin) => Promise<void> }) {
  const { t } = useT()
  const [deviceId, setDeviceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onIssued(await admin.issueDeviceLogin(deviceId.trim()))
      setDeviceId('')
    } catch (err) {
      setError(errorMessage(err, t('networkError')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('addDevice')}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t('deviceId')}
          name="deviceId"
          required
          autoFocus
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="shellyplus1-a8032abcdef0"
          hint={t('deviceIdHint')}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="cta" loading={saving}>{t('createLogin')}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Shows a freshly issued login once, with copy buttons and links that configure the Shelly over its local HTTP RPC. */
function LoginModal({ login, onClose }: { login: DeviceLogin | null; onClose: () => void }) {
  const { t } = useT()
  const [address, setAddress] = useState(SHELLY_AP_ADDRESS)
  if (!login) return null

  const host = address.trim().replace(/[^A-Za-z0-9.:-]/g, '') || SHELLY_AP_ADDRESS
  const config = {
    enable: true,
    server: login.server,
    // Must equal the device id: the backend sends to <deviceId>/rpc and the broker only lets the device use <deviceId>/#.
    client_id: login.deviceId,
    topic_prefix: login.deviceId,
    user: login.username,
    pass: login.password,
    enable_rpc: true,
    rpc_ntf: true,
    status_ntf: true,
  }
  const setConfigUrl = `http://${host}/rpc/MQTT.SetConfig?config=${encodeURIComponent(JSON.stringify(config))}`
  const rebootUrl = `http://${host}/rpc/Shelly.Reboot`

  return (
    <Modal open onClose={onClose} title={t('deviceLoginTitle')} footer={<Button onClick={onClose}>{t('close')}</Button>}>
      <div className="space-y-5">
        {!login.live && <Alert tone="warning">{t('loginNotLive')}</Alert>}
        <p className="text-ink">{t('deviceLoginIntro')}</p>
        <dl className="grid gap-1">
          <CopyRow label={t('mqttServer')} value={login.server} />
          <CopyRow label={t('mqttUsername')} value={login.username} />
          <CopyRow label={t('mqttPassword')} value={login.password} />
        </dl>
        <p className="text-[15px] text-ink-3">{t('deviceLoginSwitches')}</p>

        <div className="space-y-3 bg-paper p-4">
          <h3 className="text-xl font-extrabold tracking-[-0.03em] text-ink">{t('deviceAutoSetup')}</h3>
          <p className="text-[15px] text-ink-3">{t('deviceAutoSetupHint')}</p>
          <Input label={t('deviceAddress')} name="shellyAddress" value={address} onChange={(e) => setAddress(e.target.value)} inputMode="url" />
          <div className="grid gap-2">
            <a className="btn btn-accent" href={setConfigUrl} target="_blank" rel="noreferrer">{t('sendSettings')}</a>
            <a className="btn btn-tone" href={rebootUrl} target="_blank" rel="noreferrer">{t('rebootDevice')}</a>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the value is selectable */
    }
  }
  return (
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      <div className="flex-1 min-w-0">
        <dt className="text-[15px] text-ink-3">{label}</dt>
        <dd className="font-semibold text-[17px] break-all select-all">{value}</dd>
      </div>
      <Button size="sm" variant="ghost" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={() => void copy()}>
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  )
}
