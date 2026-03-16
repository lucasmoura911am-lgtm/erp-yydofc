import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ManageSignedTimeReports from './pages/ManageSignedTimeReports';
import MySignedTimeReports from './pages/MySignedTimeReports';
import Clients from './pages/Clients';
import Contracts from './pages/Contracts';
import Allocations from './pages/Allocations';
import AllocationReports from './pages/AllocationReports';
import MyAbsenceJustifications from './pages/MyAbsenceJustifications';
import ManageAbsenceJustifications from './pages/ManageAbsenceJustifications';
import BenefitConfigs from './pages/BenefitConfigs';
import EmployeeBenefits from './pages/EmployeeBenefits';
import DocumentTemplates from './pages/DocumentTemplates';
import GenerateDocument from './pages/GenerateDocument';
import GeneratedDocuments from './pages/GeneratedDocuments';
import EPICatalog from './pages/EPICatalog';
import EPIDeliveries from './pages/EPIDeliveries';
import EPIRecords from './pages/EPIRecords';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

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
      <Route path="/ManageSignedTimeReports" element={
        <LayoutWrapper currentPageName="ManageSignedTimeReports">
          <ManageSignedTimeReports />
        </LayoutWrapper>
      } />
      <Route path="/MySignedTimeReports" element={
        <LayoutWrapper currentPageName="MySignedTimeReports">
          <MySignedTimeReports />
        </LayoutWrapper>
      } />
      <Route path="/Clients" element={
        <LayoutWrapper currentPageName="Clients">
          <Clients />
        </LayoutWrapper>
      } />
      <Route path="/Contracts" element={
        <LayoutWrapper currentPageName="Contracts">
          <Contracts />
        </LayoutWrapper>
      } />
      <Route path="/Allocations" element={
        <LayoutWrapper currentPageName="Allocations">
          <Allocations />
        </LayoutWrapper>
      } />
      <Route path="/AllocationReports" element={
        <LayoutWrapper currentPageName="AllocationReports">
          <AllocationReports />
        </LayoutWrapper>
      } />
      <Route path="/MyAbsenceJustifications" element={
        <LayoutWrapper currentPageName="MyAbsenceJustifications">
          <MyAbsenceJustifications />
        </LayoutWrapper>
      } />
      <Route path="/ManageAbsenceJustifications" element={
        <LayoutWrapper currentPageName="ManageAbsenceJustifications">
          <ManageAbsenceJustifications />
        </LayoutWrapper>
      } />
      <Route path="/BenefitConfigs" element={
        <LayoutWrapper currentPageName="BenefitConfigs">
          <BenefitConfigs />
        </LayoutWrapper>
      } />
      <Route path="/EmployeeBenefits" element={
        <LayoutWrapper currentPageName="EmployeeBenefits">
          <EmployeeBenefits />
        </LayoutWrapper>
      } />
      <Route path="/DocumentTemplates" element={
        <LayoutWrapper currentPageName="DocumentTemplates">
          <DocumentTemplates />
        </LayoutWrapper>
      } />
      <Route path="/GenerateDocument" element={
        <LayoutWrapper currentPageName="GenerateDocument">
          <GenerateDocument />
        </LayoutWrapper>
      } />
      <Route path="/GeneratedDocuments" element={
        <LayoutWrapper currentPageName="GeneratedDocuments">
          <GeneratedDocuments />
        </LayoutWrapper>
      } />
      <Route path="/EPICatalog" element={
        <LayoutWrapper currentPageName="EPICatalog">
          <EPICatalog />
        </LayoutWrapper>
      } />
      <Route path="/EPIDeliveries" element={
        <LayoutWrapper currentPageName="EPIDeliveries">
          <EPIDeliveries />
        </LayoutWrapper>
      } />
      <Route path="/EPIRecords" element={
        <LayoutWrapper currentPageName="EPIRecords">
          <EPIRecords />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App