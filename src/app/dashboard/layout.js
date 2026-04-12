import "./dashboard.css";
import DashboardRoot from "@/components/dashboard/DashboardRoot";

export const metadata = {
    title: "لوحة الإدارة | يسلمو",
    description: "إدارة التطبيق",
};

export default function DashboardLayout({ children }) {
    return <DashboardRoot>{children}</DashboardRoot>;
}
