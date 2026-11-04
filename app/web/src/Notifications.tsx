import { useEffect, useRef, useState } from 'react'
import { Button, List, ListItemStandard, Popover, ShellBarItem, Text, Title } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/bell.js'
import { list, parsed } from './api'
import type { User } from './main'

type Note = { id: string; text: string; at?: string; href: string; tab?: string }

// Built from the same data each screen reads, so nothing new is stored. A worker's outside
// job search stays out of the manager's list, as everywhere else.
async function workerNotes(): Promise<Note[]> {
  const [skills, requests, hire, decisions] = await Promise.all([
    list('/worker/Skills?$select=ID,name'),
    list("/worker/MyRequests?$filter=status ne 'pending'&$orderby=decidedAt desc&$top=10"),
    parsed<any>('/worker/myHireRequests()'),
    list('/worker/MyDecisions?$orderby=createdAt desc&$top=3')
  ])
  const name = (id: string) => skills.find(s => s.ID === id)?.name ?? id
  return [
    ...requests.map(r => r.status === 'verified'
      ? { id: r.ID, at: r.decidedAt, href: '#/worker', tab: 'passport', text: `${r.decidedByName} verified your ${name(r.skill_ID)} skill. Your certificate is ready.` }
      : { id: r.ID, at: r.decidedAt, href: '#/worker', tab: 'requests', text: `${r.decidedByName} answered "not yet" on ${name(r.skill_ID)}${r.note ? `: ${r.note}` : '.'}` }),
    ...hire.requests.filter((i: any) => i.status === 'pending').map((i: any) => ({ id: i.ID, at: i.at, href: '#/worker', tab: 'match', text: `${i.company} would like to connect about a ${i.role} role.` })),
    ...hire.access.filter((a: any) => a.status === 'interview').map((a: any) => ({ id: a.ID, at: a.at, href: '#/worker', tab: 'match', text: `${a.company} invited you to an interview for ${a.role}.` })),
    ...hire.access.filter((a: any) => a.status === 'offered').map((a: any) => ({ id: `${a.ID}-offer`, at: a.at, href: '#/worker', tab: 'requests', text: `${a.company} offered you the ${a.role} job.` })),
    ...hire.access.filter((a: any) => a.status === 'joined').map((a: any) => ({ id: `${a.ID}-joined`, at: a.at, href: '#/worker', tab: 'passport', text: `Welcome to ${a.company}! Your certificates came with you.` })),
    ...decisions.map(d => ({ id: d.ID, at: d.createdAt, href: '#/worker', tab: 'match', text: d.outcome === 'move_to_role' ? 'Congratulations! Your manager moved you into the new role.' : d.outcome === 'shortlist' ? 'You were shortlisted in your role review.' : d.outcome === 'request_evidence' ? 'Your manager asked for more evidence in your role review.' : 'Your role review was answered: not yet.' }))
  ]
}

async function managerNotes(user: User): Promise<Note[]> {
  const verifies = user.roles.includes('Manager') || user.roles.includes('Supervisor')
  const hires = user.roles.includes('Manager') || user.roles.includes('HRAdmin')
  const [skills, requests, applicants, outreach, leavers] = await Promise.all([
    list('/manager/Skills?$select=ID,name'),
    verifies ? parsed<any[]>('/manager/verificationRequests()') : [],
    hires ? parsed<any[]>('/manager/applicants()') : [],
    hires ? parsed<any[]>('/manager/outreach()') : [],
    hires ? parsed<any[]>('/manager/leavers()') : []
  ])
  const name = (id: string) => skills.find(s => s.ID === id)?.name ?? id
  return [
    ...requests.map(r => ({ id: r.ID, at: r.requestedAt, href: '#/manager/verify', text: `${r.workerName} asked you to verify ${name(r.skill_ID)}.` })),
    ...leavers.map(l => ({ id: `${l.ID}-leaving`, at: l.at, href: `#/manager/team/${l.worker}`, text: `${l.name} has resigned. Last day: ${new Date(l.leavesOn).toLocaleDateString()}.` })),
    ...applicants.filter(a => a.status === 'accepted' || a.status === 'declined').map(a => ({ id: `${a.ID}-${a.status}`, at: a.changedAt, href: '#/manager/applicants', text: `${a.applicant} ${a.status === 'accepted' ? 'accepted' : 'declined'} your offer for ${a.role}.` })),
    ...applicants.filter(a => a.status === 'applied').map(a => ({ id: a.ID, at: a.appliedAt, href: '#/manager/applicants', text: `${a.applicant} applied for ${a.role}.` })),
    ...outreach.filter(o => o.status === 'granted' || o.status === 'declined').map(o => ({
      id: o.ID, at: o.decidedAt, href: '#/manager/hire',
      text: o.status === 'granted' ? `${o.who} said yes and shared certificates for ${o.role}.` : `A candidate said no to your ${o.role} request.`
    }))
  ]
}

const seenKey = (user: User) => `fs-notes-seen-${user.persona || user.name}`
const readSeen = (user: User) => { try { return Number(localStorage.getItem(seenKey(user)) ?? 0) } catch { return 0 } }
const ago = (at?: string) => {
  if (!at) return ''
  const min = Math.round((Date.now() - new Date(at).getTime()) / 60000)
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : new Date(at).toLocaleDateString()
}

/** The bell for the shell bar and its panel, apart: the shell bar takes only items as children.
 * Checks every 20 seconds, so a request sent on one laptop shows on the other. */
export function useNotifications(user: User | null) {
  const [notes, setNotes] = useState<Note[]>([])
  const [seen, setSeen] = useState(0)
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!user?.registered) return
    setSeen(readSeen(user))
    const isWorker = user.roles.includes('Worker')
    const isStaff = user.roles.some(r => r !== 'Worker')
    const load = () => Promise.all([isWorker ? workerNotes().catch(() => []) : [], isStaff ? managerNotes(user).catch(() => []) : []])
      .then(([a, b]) => setNotes([...a, ...b].sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))))
    load()
    const timer = setInterval(load, 20_000)
    return () => clearInterval(timer)
  }, [user])

  const unread = notes.filter(n => n.at && new Date(n.at).getTime() > seen).length
  const close = () => {
    setOpen(false)
    const now = Date.now()
    setSeen(now)
    try { if (user) localStorage.setItem(seenKey(user), String(now)) } catch { /* the badge just comes back next visit */ }
  }
  const go = (n: Note) => {
    close()
    location.hash = n.href
    if (n.tab) setTimeout(() => dispatchEvent(new CustomEvent('worker-tab', { detail: n.tab })), 0)
  }

  if (!user?.registered) return { bell: null, panel: null }
  return {
    bell: <ShellBarItem icon="bell" text="Notifications" count={unread ? String(unread) : undefined} onClick={e => { opener.current = e.detail.targetRef; setOpen(true) }} />,
    panel: (
      <Popover open={open} opener={opener.current ?? undefined} placement="Bottom" horizontalAlign="End" onClose={close} className="notes-popover">
        <div className="notes">
          <Title level="H5">Notifications</Title>
          {!notes.length && <Text className="fine-print">Nothing new. You're up to date.</Text>}
          {notes.length > 0 && (
            <List separators="Inner" onItemClick={e => { const n = notes.find(x => x.id === e.detail.item.dataset.id); if (n) go(n) }}>
              {notes.slice(0, 12).map(n => (
                <ListItemStandard key={n.id} data-id={n.id} type="Navigation" wrappingType="Normal" className={n.at && new Date(n.at).getTime() > seen ? 'unread' : ''} description={ago(n.at)}>{n.text}</ListItemStandard>
              ))}
            </List>
          )}
          <Button design="Transparent" onClick={close}>Close</Button>
        </div>
      </Popover>
    )
  }
}
