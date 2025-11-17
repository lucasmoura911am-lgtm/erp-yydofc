import Dashboard from './pages/Dashboard';
import ClockIn from './pages/ClockIn';
import Employees from './pages/Employees';
import TimeRecords from './pages/TimeRecords';
import Departments from './pages/Departments';
import Positions from './pages/Positions';
import Shifts from './pages/Shifts';
import MyTimeRecords from './pages/MyTimeRecords';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Announcements from './pages/Announcements';
import Companies from './pages/Companies';
import CompanySetup from './pages/CompanySetup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "ClockIn": ClockIn,
    "Employees": Employees,
    "TimeRecords": TimeRecords,
    "Departments": Departments,
    "Positions": Positions,
    "Shifts": Shifts,
    "MyTimeRecords": MyTimeRecords,
    "Reports": Reports,
    "Settings": Settings,
    "Home": Home,
    "Announcements": Announcements,
    "Companies": Companies,
    "CompanySetup": CompanySetup,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};