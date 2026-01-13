import Announcements from './pages/Announcements';
import ClockIn from './pages/ClockIn';
import Companies from './pages/Companies';
import CompanySetup from './pages/CompanySetup';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Employees from './pages/Employees';
import Home from './pages/Home';
import ManageTimeRecords from './pages/ManageTimeRecords';
import MyTimeRecords from './pages/MyTimeRecords';
import Positions from './pages/Positions';
import PublicClockIn from './pages/PublicClockIn';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Shifts from './pages/Shifts';
import SupervisorDashboard from './pages/SupervisorDashboard';
import Supervisors from './pages/Supervisors';
import Teams from './pages/Teams';
import TimeRecords from './pages/TimeRecords';
import UsersManagement from './pages/UsersManagement';
import TasksDashboard from './pages/TasksDashboard';
import ManageTasks from './pages/ManageTasks';
import MyTasks from './pages/MyTasks';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Announcements": Announcements,
    "ClockIn": ClockIn,
    "Companies": Companies,
    "CompanySetup": CompanySetup,
    "Dashboard": Dashboard,
    "Departments": Departments,
    "EmployeeDashboard": EmployeeDashboard,
    "Employees": Employees,
    "Home": Home,
    "ManageTimeRecords": ManageTimeRecords,
    "MyTimeRecords": MyTimeRecords,
    "Positions": Positions,
    "PublicClockIn": PublicClockIn,
    "Reports": Reports,
    "Settings": Settings,
    "Shifts": Shifts,
    "SupervisorDashboard": SupervisorDashboard,
    "Supervisors": Supervisors,
    "Teams": Teams,
    "TimeRecords": TimeRecords,
    "UsersManagement": UsersManagement,
    "TasksDashboard": TasksDashboard,
    "ManageTasks": ManageTasks,
    "MyTasks": MyTasks,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};