import type { ComponentType } from 'react'
import type { TaxReturn } from '../model/types.ts'
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
import { PriorYearPage } from '../ui/pages/PriorYearPage.tsx'
import { DeductionsPage } from '../ui/pages/DeductionsPage.tsx'
import { CreditsPage } from '../ui/pages/CreditsPage.tsx'
import { ReviewPage } from '../ui/pages/ReviewPage.tsx'
import { DownloadPage } from '../ui/pages/DownloadPage.tsx'

export interface InterviewStep {
  id: string
  label: string
  path: string
  isVisible: (tr: TaxReturn) => boolean
  isComplete: (tr: TaxReturn) => boolean
  component: ComponentType
}

export const STEPS: InterviewStep[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    path: '/',
    isVisible: () => true,
    isComplete: () => true,
    component: WelcomePage,
  },
  {
    id: 'filing-status',
    label: 'Filing Status',
    path: '/interview/filing-status',
    isVisible: () => true,
    isComplete: (tr) => tr.filingStatus !== undefined,
    component: FilingStatusPage,
  },
  {
    id: 'personal-info',
    label: 'Your Info',
    path: '/interview/personal-info',
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
    isVisible: () => true,
    isComplete: () => true,
    component: DependentsPage,
  },
  {
    id: 'prior-year',
    label: 'Prior Year',
    path: '/interview/prior-year',
    isVisible: () => true,
    isComplete: () => true,
    component: PriorYearPage,
  },
  {
    id: 'w2-income',
    label: 'W-2 Income',
    path: '/interview/w2-income',
    isVisible: () => true,
    isComplete: (tr) => tr.w2s.length > 0,
    component: W2IncomePage,
  },
  {
    id: 'interest-income',
    label: 'Interest',
    path: '/interview/interest-income',
    isVisible: () => true,
    isComplete: () => true,
    component: InterestIncomePage,
  },
  {
    id: 'dividend-income',
    label: 'Dividends',
    path: '/interview/dividend-income',
    isVisible: () => true,
    isComplete: () => true,
    component: DividendIncomePage,
  },
  {
    id: 'misc-income',
    label: 'Other Income',
    path: '/interview/misc-income',
    isVisible: () => true,
    isComplete: () => true,
    component: MiscIncomePage,
  },
  {
    id: 'stock-sales',
    label: 'Stock Sales',
    path: '/interview/stock-sales',
    isVisible: () => true,
    isComplete: () => true,
    component: StockSalesPage,
  },
  {
    id: 'rsu-income',
    label: 'RSU Income',
    path: '/interview/rsu-income',
    isVisible: (tr) =>
      tr.rsuVestEvents.length > 0 ||
      tr.w2s.some((w) => w.box12.some((e) => e.code === 'V')),
    isComplete: () => true,
    component: RSUIncomePage,
  },
  {
    id: 'deductions',
    label: 'Deductions',
    path: '/interview/deductions',
    isVisible: () => true,
    isComplete: () => true,
    component: DeductionsPage,
  },
  {
    id: 'credits',
    label: 'Credits',
    path: '/interview/credits',
    isVisible: () => true,
    isComplete: () => true,
    component: CreditsPage,
  },
  {
    id: 'review',
    label: 'Review',
    path: '/review',
    isVisible: () => true,
    isComplete: () => false,
    component: ReviewPage,
  },
  {
    id: 'download',
    label: 'Download',
    path: '/download',
    isVisible: () => true,
    isComplete: () => false,
    component: DownloadPage,
  },
]
