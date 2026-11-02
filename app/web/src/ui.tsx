import { ReactNode } from 'react'
import { Avatar, Card, IllustratedMessage, ObjectStatus, Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow, Title } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js'

export const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')

export const STAGE: Record<string, { label: string; state: 'None' | 'Information' | 'Positive' | 'Critical' }> = {
  NOT_STARTED: { label: 'Not started', state: 'None' },
  HALTED: { label: 'Data erased', state: 'None' },
  DISCOVERING: { label: 'Building profile', state: 'Information' },
  AWAITING_READBACK: { label: 'Confirming profile', state: 'Information' },
  ACTIVE: { label: 'Profile active', state: 'Information' },
  AWAITING_MANAGER: { label: 'Waiting for role review', state: 'Critical' },
  SHORTLISTED: { label: 'Shortlisted', state: 'Positive' }
}

export const StageStatus = ({ stage }: { stage: string }) => <ObjectStatus state={STAGE[stage]?.state ?? 'None'}>{STAGE[stage]?.label ?? stage}</ObjectStatus>

export const Empty = ({ title, subtitle }: { title: string; subtitle?: string }) => <IllustratedMessage name="NoEntries" titleText={title} subtitleText={subtitle} />

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <Table
      overflowMode="Popin"
      headerRow={<TableHeaderRow>{columns.map(c => <TableHeaderCell key={c}><span>{c}</span></TableHeaderCell>)}</TableHeaderRow>}
    >
      {rows.map((cells, i) => <TableRow key={i}>{cells.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>)}
    </Table>
  )
}

type Labels = { employeeId: string; department: string; shift: string; reportsTo: string; site: string; joined: string; source: string }

export const PROFILE_LABELS: Labels = {
  employeeId: 'Employee ID', department: 'Department', shift: 'Shift', reportsTo: 'Reports to', site: 'Site', joined: 'Joined',
  source: 'Employee record: sample data in the shape of SuccessFactors Employee Central.'
}

/** The employee record, the same card for the worker and their manager. */
export function ProfileCard({ person, company, labels = PROFILE_LABELS, action }: { person: any; company?: string; labels?: Labels; action?: ReactNode }) {
  return (
    <Card>
      <div className="profile-card">
        <div className="profile-head">
          <Avatar size="L" initials={initials(person.name)} />
          <div className="profile-name">
            <Title level="H1" size="H3">{person.name}</Title>
            <span>{[person.jobTitle, company].filter(Boolean).join(', ')}</span>
          </div>
          {action}
        </div>
        <dl className="profile-facts">
          <div><dt>{labels.employeeId}</dt><dd>{person.employeeCode}</dd></div>
          <div><dt>{labels.department}</dt><dd>{person.department}</dd></div>
          <div><dt>{labels.shift}</dt><dd>{person.workShift}</dd></div>
          <div><dt>{labels.site}</dt><dd>{person.site}</dd></div>
          <div><dt>{labels.reportsTo}</dt><dd>{person.managerName}</dd></div>
          <div><dt>{labels.joined}</dt><dd>{person.joinedOn ? new Date(person.joinedOn).toLocaleDateString() : ''}</dd></div>
        </dl>
        <p className="fine-print">{labels.source}</p>
      </div>
    </Card>
  )
}
