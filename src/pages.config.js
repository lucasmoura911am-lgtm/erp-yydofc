import Dashboard from './pages/Dashboard';
import ClockIn from './pages/ClockIn';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "ClockIn": ClockIn,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};