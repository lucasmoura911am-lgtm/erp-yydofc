import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import EmployeeFolder from './pages/EmployeeFolder';
import MyDocuments from './pages/MyDocuments';
import EPICatalog from './pages/EPICatalog';
import EPIDeliveries from './pages/EPIDeliveries';
import EPIRecords from './pages/EPIRecords';
import SafetyDashboard from './pages/SafetyDashboard';
import SafetyPrograms from './pages/SafetyPrograms';
import RiskInventoryPage from './pages/RiskInventoryPage';
import RiskActionPlanPage from './pages/RiskActionPlanPage';
import HealthActivitiesPage from './pages/HealthActivitiesPage';
import SafetyReports from './pages/SafetyReports';
import BenefitConfigs from './pages/BenefitConfigs';
import EmployeeBenefits from './pages/EmployeeBenefits';
import ManageTasks from './pages/ManageTasks';
import TasksDashboard from './pages/TasksDashboard';
import ManageVacations from './pages/ManageVacations';
import ManagePayslips from './pages/ManagePayslips';
import MyVacations from './pages/MyVacations';
import MyPayslips from './pages/MyPayslips';
import MyTasks from './pages/MyTasks';
import Clients from './pages/Clients';
import Contracts from './pages/Contracts';
import Allocations from './pages/Allocations';
import AllocationReports from './pages/AllocationReports';
import Reports from './pages/Reports';
import MoodReport from './pages/MoodReport';
import Announcements from './pages/Announcements';
import Settings from './pages/Settings';
import UsersManagement from './pages/UsersManagement';
import Companies from './pages/Companies';
import SupervisorDashboard from './pages/SupervisorDashboard';
import Supervisors from './pages/Supervisors';
import ManageAbsenceJustifications from './pages/ManageAbsenceJustifications';
import MyAbsenceJustifications from './pages/MyAbsenceJustifications';
import ManageSignedTimeReports from './pages/ManageSignedTimeReports';
import MySignedTimeReports from './pages/MySignedTimeReports';
import HoursBank from './pages/HoursBank';
import ManageTimeRecordsSimple from './pages/ManageTimeRecordsSimple';
import DocumentTemplates from './pages/DocumentTemplates';
import GenerateDocument from './pages/GenerateDocument';
import GeneratedDocuments from './pages/GeneratedDocuments';
import Teams from './pages/Teams';
import MyTimeRecords from './pages/MyTimeRecords';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ClockIn from './pages/ClockIn';
import SuppliersPage from './pages/SuppliersPage';
import CRMDashboard from './pages/CRMDashboard';
import CRMKanban from './pages/CRMKanban';
import CRMLeads from './pages/CRMLeads';
import CRMAccounts from './pages/CRMAccounts';
import CRMContacts from './pages/CRMContacts';
import CRMOpportunities from './pages/CRMOpportunities';
import CRMProposals from './pages/CRMProposals';
import CRMActivities from './pages/CRMActivities';
import CRMGoals from './pages/CRMGoals';
import FinancialDashboard from './pages/FinancialDashboard';
import AccountsPayablePage from './pages/AccountsPayablePage';
import AccountsReceivablePage from './pages/AccountsReceivablePage';
import CashFlowPage from './pages/CashFlowPage';
import FinancialSettings from './pages/FinancialSettings';
import BankReconciliationPage from './pages/BankReconciliationPage';
import FinancialReports from './pages/FinancialReports';
import FinancialDRE from './pages/FinancialDRE';
import BudgetVsActual from './pages/BudgetVsActual';
import RecruitmentOverview from './pages/RecruitmentOverview';
import Overview360 from './pages/Overview360';
import BirthdaysAndDates from './pages/BirthdaysAndDates';
import ProductivityHub from './pages/ProductivityHub';
import WorkActivities from './pages/WorkActivities';
import ProductivityKanban from './pages/ProductivityKanban';
import ProductivityAgenda from './pages/ProductivityAgenda';
import ProductivityNotices from './pages/ProductivityNotices';
import ProductivityManager from './pages/ProductivityManager';
import JobPositions from './pages/JobPositions';
import CandidatePool from './pages/CandidatePool';
import RecruitmentKanban from './pages/RecruitmentKanban';
import Interviews from './pages/Interviews';
import PurchaseOrders from './pages/PurchaseOrders';
import StockControl from './pages/StockControl';
import UniformControl from './pages/UniformControl';
import EPIDailyLogs from './pages/EPIDailyLogs';
import MaintenancePage from './pages/MaintenancePage';
import OccurrencesPage from './pages/OccurrencesPage';
import ContractStockPage from './pages/ContractStockPage';
import OperationsDashboard from './pages/OperationsDashboard';
import ClientPortal from './pages/ClientPortal';
import ClientDocuments from './pages/ClientDocuments';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/EmployeeFolder" element={<LayoutWrapper currentPageName="EmployeeFolder"><EmployeeFolder /></LayoutWrapper>} />
      <Route path="/MyDocuments" element={<LayoutWrapper currentPageName="MyDocuments"><MyDocuments /></LayoutWrapper>} />
      <Route path="/EPICatalog" element={<LayoutWrapper currentPageName="EPICatalog"><EPICatalog /></LayoutWrapper>} />
      <Route path="/EPIDeliveries" element={<LayoutWrapper currentPageName="EPIDeliveries"><EPIDeliveries /></LayoutWrapper>} />
      <Route path="/EPIRecords" element={<LayoutWrapper currentPageName="EPIRecords"><EPIRecords /></LayoutWrapper>} />
      <Route path="/SafetyDashboard" element={<LayoutWrapper currentPageName="SafetyDashboard"><SafetyDashboard /></LayoutWrapper>} />
      <Route path="/SafetyPrograms" element={<LayoutWrapper currentPageName="SafetyPrograms"><SafetyPrograms /></LayoutWrapper>} />
      <Route path="/RiskInventoryPage" element={<LayoutWrapper currentPageName="RiskInventoryPage"><RiskInventoryPage /></LayoutWrapper>} />
      <Route path="/RiskActionPlanPage" element={<LayoutWrapper currentPageName="RiskActionPlanPage"><RiskActionPlanPage /></LayoutWrapper>} />
      <Route path="/HealthActivitiesPage" element={<LayoutWrapper currentPageName="HealthActivitiesPage"><HealthActivitiesPage /></LayoutWrapper>} />
      <Route path="/SafetyReports" element={<LayoutWrapper currentPageName="SafetyReports"><SafetyReports /></LayoutWrapper>} />
      <Route path="/BenefitConfigs" element={<LayoutWrapper currentPageName="BenefitConfigs"><BenefitConfigs /></LayoutWrapper>} />
      <Route path="/EmployeeBenefits" element={<LayoutWrapper currentPageName="EmployeeBenefits"><EmployeeBenefits /></LayoutWrapper>} />
      <Route path="/ManageTasks" element={<LayoutWrapper currentPageName="ManageTasks"><ManageTasks /></LayoutWrapper>} />
      <Route path="/TasksDashboard" element={<LayoutWrapper currentPageName="TasksDashboard"><TasksDashboard /></LayoutWrapper>} />
      <Route path="/ManageVacations" element={<LayoutWrapper currentPageName="ManageVacations"><ManageVacations /></LayoutWrapper>} />
      <Route path="/ManagePayslips" element={<LayoutWrapper currentPageName="ManagePayslips"><ManagePayslips /></LayoutWrapper>} />
      <Route path="/MyVacations" element={<LayoutWrapper currentPageName="MyVacations"><MyVacations /></LayoutWrapper>} />
      <Route path="/MyPayslips" element={<LayoutWrapper currentPageName="MyPayslips"><MyPayslips /></LayoutWrapper>} />
      <Route path="/MyTasks" element={<LayoutWrapper currentPageName="MyTasks"><MyTasks /></LayoutWrapper>} />
      <Route path="/Clients" element={<LayoutWrapper currentPageName="Clients"><Clients /></LayoutWrapper>} />
      <Route path="/Contracts" element={<LayoutWrapper currentPageName="Contracts"><Contracts /></LayoutWrapper>} />
      <Route path="/Allocations" element={<LayoutWrapper currentPageName="Allocations"><Allocations /></LayoutWrapper>} />
      <Route path="/AllocationReports" element={<LayoutWrapper currentPageName="AllocationReports"><AllocationReports /></LayoutWrapper>} />
      <Route path="/Reports" element={<LayoutWrapper currentPageName="Reports"><Reports /></LayoutWrapper>} />
      <Route path="/MoodReport" element={<LayoutWrapper currentPageName="MoodReport"><MoodReport /></LayoutWrapper>} />
      <Route path="/Announcements" element={<LayoutWrapper currentPageName="Announcements"><Announcements /></LayoutWrapper>} />
      <Route path="/Settings" element={<LayoutWrapper currentPageName="Settings"><Settings /></LayoutWrapper>} />
      <Route path="/UsersManagement" element={<LayoutWrapper currentPageName="UsersManagement"><UsersManagement /></LayoutWrapper>} />
      <Route path="/Companies" element={<LayoutWrapper currentPageName="Companies"><Companies /></LayoutWrapper>} />
      <Route path="/SupervisorDashboard" element={<LayoutWrapper currentPageName="SupervisorDashboard"><SupervisorDashboard /></LayoutWrapper>} />
      <Route path="/Supervisors" element={<LayoutWrapper currentPageName="Supervisors"><Supervisors /></LayoutWrapper>} />
      <Route path="/ManageAbsenceJustifications" element={<LayoutWrapper currentPageName="ManageAbsenceJustifications"><ManageAbsenceJustifications /></LayoutWrapper>} />
      <Route path="/MyAbsenceJustifications" element={<LayoutWrapper currentPageName="MyAbsenceJustifications"><MyAbsenceJustifications /></LayoutWrapper>} />
      <Route path="/ManageSignedTimeReports" element={<LayoutWrapper currentPageName="ManageSignedTimeReports"><ManageSignedTimeReports /></LayoutWrapper>} />
      <Route path="/MySignedTimeReports" element={<LayoutWrapper currentPageName="MySignedTimeReports"><MySignedTimeReports /></LayoutWrapper>} />
      <Route path="/HoursBank" element={<LayoutWrapper currentPageName="HoursBank"><HoursBank /></LayoutWrapper>} />
      <Route path="/ManageTimeRecordsSimple" element={<LayoutWrapper currentPageName="ManageTimeRecordsSimple"><ManageTimeRecordsSimple /></LayoutWrapper>} />
      <Route path="/DocumentTemplates" element={<LayoutWrapper currentPageName="DocumentTemplates"><DocumentTemplates /></LayoutWrapper>} />
      <Route path="/GenerateDocument" element={<LayoutWrapper currentPageName="GenerateDocument"><GenerateDocument /></LayoutWrapper>} />
      <Route path="/GeneratedDocuments" element={<LayoutWrapper currentPageName="GeneratedDocuments"><GeneratedDocuments /></LayoutWrapper>} />
      <Route path="/Teams" element={<LayoutWrapper currentPageName="Teams"><Teams /></LayoutWrapper>} />
      <Route path="/MyTimeRecords" element={<LayoutWrapper currentPageName="MyTimeRecords"><MyTimeRecords /></LayoutWrapper>} />
      <Route path="/EmployeeDashboard" element={<LayoutWrapper currentPageName="EmployeeDashboard"><EmployeeDashboard /></LayoutWrapper>} />
      <Route path="/ClockIn" element={<LayoutWrapper currentPageName="ClockIn"><ClockIn /></LayoutWrapper>} />
      <Route path="/SuppliersPage" element={<LayoutWrapper currentPageName="SuppliersPage"><SuppliersPage /></LayoutWrapper>} />
      <Route path="/CRMDashboard" element={<LayoutWrapper currentPageName="CRMDashboard"><CRMDashboard /></LayoutWrapper>} />
      <Route path="/CRMKanban" element={<LayoutWrapper currentPageName="CRMKanban"><CRMKanban /></LayoutWrapper>} />
      <Route path="/CRMLeads" element={<LayoutWrapper currentPageName="CRMLeads"><CRMLeads /></LayoutWrapper>} />
      <Route path="/CRMAccounts" element={<LayoutWrapper currentPageName="CRMAccounts"><CRMAccounts /></LayoutWrapper>} />
      <Route path="/CRMContacts" element={<LayoutWrapper currentPageName="CRMContacts"><CRMContacts /></LayoutWrapper>} />
      <Route path="/CRMOpportunities" element={<LayoutWrapper currentPageName="CRMOpportunities"><CRMOpportunities /></LayoutWrapper>} />
      <Route path="/CRMProposals" element={<LayoutWrapper currentPageName="CRMProposals"><CRMProposals /></LayoutWrapper>} />
      <Route path="/CRMActivities" element={<LayoutWrapper currentPageName="CRMActivities"><CRMActivities /></LayoutWrapper>} />
      <Route path="/CRMGoals" element={<LayoutWrapper currentPageName="CRMGoals"><CRMGoals /></LayoutWrapper>} />
      <Route path="/FinancialDashboard" element={<LayoutWrapper currentPageName="FinancialDashboard"><FinancialDashboard /></LayoutWrapper>} />
      <Route path="/AccountsPayablePage" element={<LayoutWrapper currentPageName="AccountsPayablePage"><AccountsPayablePage /></LayoutWrapper>} />
      <Route path="/AccountsReceivablePage" element={<LayoutWrapper currentPageName="AccountsReceivablePage"><AccountsReceivablePage /></LayoutWrapper>} />
      <Route path="/CashFlowPage" element={<LayoutWrapper currentPageName="CashFlowPage"><CashFlowPage /></LayoutWrapper>} />
      <Route path="/FinancialSettings" element={<LayoutWrapper currentPageName="FinancialSettings"><FinancialSettings /></LayoutWrapper>} />
      <Route path="/BankReconciliationPage" element={<LayoutWrapper currentPageName="BankReconciliationPage"><BankReconciliationPage /></LayoutWrapper>} />
      <Route path="/FinancialReports" element={<LayoutWrapper currentPageName="FinancialReports"><FinancialReports /></LayoutWrapper>} />
      <Route path="/FinancialDRE" element={<LayoutWrapper currentPageName="FinancialDRE"><FinancialDRE /></LayoutWrapper>} />
      <Route path="/BudgetVsActual" element={<LayoutWrapper currentPageName="BudgetVsActual"><BudgetVsActual /></LayoutWrapper>} />
      <Route path="/RecruitmentOverview" element={<LayoutWrapper currentPageName="RecruitmentOverview"><RecruitmentOverview /></LayoutWrapper>} />
      <Route path="/JobPositions" element={<LayoutWrapper currentPageName="JobPositions"><JobPositions /></LayoutWrapper>} />
      <Route path="/CandidatePool" element={<LayoutWrapper currentPageName="CandidatePool"><CandidatePool /></LayoutWrapper>} />
      <Route path="/RecruitmentKanban" element={<LayoutWrapper currentPageName="RecruitmentKanban"><RecruitmentKanban /></LayoutWrapper>} />
      <Route path="/Interviews" element={<LayoutWrapper currentPageName="Interviews"><Interviews /></LayoutWrapper>} />
      <Route path="/BirthdaysAndDates" element={<LayoutWrapper currentPageName="BirthdaysAndDates"><BirthdaysAndDates /></LayoutWrapper>} />
      <Route path="/ProductivityHub" element={<LayoutWrapper currentPageName="ProductivityHub"><ProductivityHub /></LayoutWrapper>} />
      <Route path="/WorkActivities" element={<LayoutWrapper currentPageName="WorkActivities"><WorkActivities /></LayoutWrapper>} />
      <Route path="/ProductivityKanban" element={<LayoutWrapper currentPageName="ProductivityKanban"><ProductivityKanban /></LayoutWrapper>} />
      <Route path="/ProductivityAgenda" element={<LayoutWrapper currentPageName="ProductivityAgenda"><ProductivityAgenda /></LayoutWrapper>} />
      <Route path="/ProductivityNotices" element={<LayoutWrapper currentPageName="ProductivityNotices"><ProductivityNotices /></LayoutWrapper>} />
      <Route path="/ProductivityManager" element={<LayoutWrapper currentPageName="ProductivityManager"><ProductivityManager /></LayoutWrapper>} />
      <Route path="/Overview360" element={<LayoutWrapper currentPageName="Overview360"><Overview360 /></LayoutWrapper>} />
      <Route path="/PurchaseOrders" element={<LayoutWrapper currentPageName="PurchaseOrders"><PurchaseOrders /></LayoutWrapper>} />
      <Route path="/StockControl" element={<LayoutWrapper currentPageName="StockControl"><StockControl /></LayoutWrapper>} />
      <Route path="/UniformControl" element={<LayoutWrapper currentPageName="UniformControl"><UniformControl /></LayoutWrapper>} />
      <Route path="/EPIDailyLogs" element={<LayoutWrapper currentPageName="EPIDailyLogs"><EPIDailyLogs /></LayoutWrapper>} />
      <Route path="/MaintenancePage" element={<LayoutWrapper currentPageName="MaintenancePage"><MaintenancePage /></LayoutWrapper>} />
      <Route path="/OccurrencesPage" element={<LayoutWrapper currentPageName="OccurrencesPage"><OccurrencesPage /></LayoutWrapper>} />
      <Route path="/ContractStockPage" element={<LayoutWrapper currentPageName="ContractStockPage"><ContractStockPage /></LayoutWrapper>} />
      <Route path="/OperationsDashboard" element={<LayoutWrapper currentPageName="OperationsDashboard"><OperationsDashboard /></LayoutWrapper>} />
      <Route path="/ClientPortal" element={<ClientPortal />} />
      <Route path="/ClientDocuments" element={<LayoutWrapper currentPageName="ClientDocuments"><ClientDocuments /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App