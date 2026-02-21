import type { ComponentType } from 'react'
import type { TaxReturn } from '../model/types.ts'
import { getSupportedStates } from '../rules/stateRegistry.ts'
import { WelcomePage } from '../ui/pages/WelcomePage.tsx'
import { FilingStatusPage } from '../ui/pages/FilingStatusPage.tsx'
import { PersonalInfoPage } from '../ui/pages/PersonalInfoPage.tsx'
import { SpouseInfoPage } from '../ui/pages/SpouseInfoPage.tsx'
import { DependentsPage } from '../ui/pages/DependentsPage.tsx'
import { W2IncomePage } from '../ui/pages/W2IncomePage.tsx'
import { InterestIncomePage } from '../ui/pages/InterestIncomePage.tsx'
import { DividendIncomePage } from '../ui/pages/DividendIncomePage.tsx'
import { MiscIncomePage } from '../ui/pages/MiscIncomePage.tsx'
import { StockSalesPage } from '../ui/pages/StockSalesPage.tsx'
import { RSUIncomePage } from '../ui/pages/RSUIncomePage.tsx'
import { ISOExercisesPage } from '../ui/pages/ISOExercisesPage.tsx'
import { Form1099GPage } from '../ui/pages/Form1099GPage.tsx'
import { RetirementIncomePage } from '../ui/pages/RetirementIncomePage.tsx'
import { ScheduleEPage } from '../ui/pages/ScheduleEPage.tsx'
import { PriorYearPage } from '../ui/pages/PriorYearPage.tsx'
import { DeductionsPage } from '../ui/pages/DeductionsPage.tsx'
import { CreditsPage } from '../ui/pages/CreditsPage.tsx'
import { ReviewPage } from '../ui/pages/ReviewPage.tsx'
import { StateReviewPage } from '../ui/pages/StateReviewPage.tsx'
import { StateReturnsPage } from '../ui/pages/StateReturnsPage.tsx'
import { DownloadPage } from '../ui/pages/DownloadPage.tsx'

export type InterviewSection =
  | 'getting-started'
  | 'income'
  | 'deductions-credits'
  | 'review'
  | 'download'

export interface InterviewStep {
  id: string
  label: string
  path: string
  section: InterviewSection
  isVisible: (tr: TaxReturn) => boolean
  isComplete: (tr: TaxReturn) => boolean
  component: ComponentType
}

/** Generate dynamic state review steps from the registry.
 *  All states use the generic config-driven StateReviewPage. */
function stateReviewSteps(): InterviewStep[] {
  return getSupportedStates().map(st => ({
    id: `state-review-${st.code}`,
    label: st.label,
    path: `/interview/state-review-${st.code}`,
    section: 'review' as const,
    isVisible: (tr: TaxReturn) =>
      (tr.stateReturns ?? []).some(s => s.stateCode === st.code),
    isComplete: () => false,
    component: StateReviewPage,
  }))
}

export const STEPS: InterviewStep[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    path: '/',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: () => true,
    component: WelcomePage,
  },
  {
    id: 'filing-status',
    label: 'Filing Status',
    path: '/interview/filing-status',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: (tr) => tr.filingStatus !== undefined,
    component: FilingStatusPage,
  },
  {
    id: 'personal-info',
    label: 'Your Info',
    path: '/interview/personal-info',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: (tr) =>
      tr.taxpayer.firstName.length > 0 &&
      tr.taxpayer.lastName.length > 0 &&
      tr.taxpayer.ssn.length === 9 &&
      tr.taxpayer.address.street.length > 0 &&
      tr.taxpayer.address.city.length > 0 &&
      tr.taxpayer.address.state.length === 2 &&
      tr.taxpayer.address.zip.length >= 5,
    component: PersonalInfoPage,
  },
  {
    id: 'spouse-info',
    label: 'Spouse Info',
    path: '/interview/spouse-info',
    section: 'getting-started',
    isVisible: (tr) => tr.filingStatus === 'mfj',
    isComplete: (tr) =>
      tr.spouse !== undefined &&
      tr.spouse.firstName.length > 0 &&
      tr.spouse.lastName.length > 0 &&
      tr.spouse.ssn.length === 9,
    component: SpouseInfoPage,
  },
  {
    id: 'dependents',
    label: 'Dependents',
    path: '/interview/dependents',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: () => true,
    component: DependentsPage,
  },
  {
    id: 'prior-year',
    label: 'Prior Year',
    path: '/interview/prior-year',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: () => true,
    component: PriorYearPage,
  },
  {
    id: 'state-returns',
    label: 'State Returns',
    path: '/interview/state-returns',
    section: 'getting-started',
    isVisible: () => true,
    isComplete: () => true,
    component: StateReturnsPage,
  },
  {
    id: 'w2-income',
    label: 'W-2 Income',
    path: '/interview/w2-income',
    section: 'income',
    isVisible: () => true,
    isComplete: (tr) => tr.w2s.length > 0,
    component: W2IncomePage,
  },
  {
    id: 'interest-income',
    label: 'Interest',
    path: '/interview/interest-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: InterestIncomePage,
  },
  {
    id: 'dividend-income',
    label: 'Dividends',
    path: '/interview/dividend-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: DividendIncomePage,
  },
  {
    id: 'misc-income',
    label: 'Other Income',
    path: '/interview/misc-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: MiscIncomePage,
  },
  {
    id: '1099g-income',
    label: 'Unemployment',
    path: '/interview/1099g-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: Form1099GPage,
  },
  {
    id: 'retirement-income',
    label: 'Retirement',
    path: '/interview/retirement-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: RetirementIncomePage,
  },
  {
    id: 'rental-income',
    label: 'Rental Income',
    path: '/interview/rental-income',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: ScheduleEPage,
  },
  {
    id: 'stock-sales',
    label: 'Stock Sales',
    path: '/interview/stock-sales',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: StockSalesPage,
  },
  {
    id: 'rsu-income',
    label: 'RSU Income',
    path: '/interview/rsu-income',
    section: 'income',
    isVisible: (tr) =>
      tr.rsuVestEvents.length > 0 ||
      tr.w2s.some((w) => w.box12.some((e) => e.code === 'V')),
    isComplete: () => true,
    component: RSUIncomePage,
  },
  {
    id: 'iso-exercises',
    label: 'ISO Exercises',
    path: '/interview/iso-exercises',
    section: 'income',
    isVisible: () => true,
    isComplete: () => true,
    component: ISOExercisesPage,
  },
  {
    id: 'deductions',
    label: 'Deductions',
    path: '/interview/deductions',
    section: 'deductions-credits',
    isVisible: () => true,
    isComplete: () => true,
    component: DeductionsPage,
  },
  {
    id: 'credits',
    label: 'Credits',
    path: '/interview/credits',
    section: 'deductions-credits',
    isVisible: () => true,
    isComplete: () => true,
    component: CreditsPage,
  },
  {
    id: 'review',
    label: 'Federal Review',
    path: '/review',
    section: 'review',
    isVisible: () => true,
    isComplete: () => false,
    component: ReviewPage,
  },
  // Dynamic state review steps (one per supported state)
  ...stateReviewSteps(),
  {
    id: 'download',
    label: 'Download',
    path: '/download',
    section: 'download',
    isVisible: () => true,
    isComplete: () => false,
    component: DownloadPage,
  },
]
