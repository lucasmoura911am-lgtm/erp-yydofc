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