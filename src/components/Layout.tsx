import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, History, Users, Settings, BarChart3, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { path: '/calculator', label: '인센티브 계산', icon: Calculator },
        { path: '/history', label: '히스토리', icon: History },
        { path: '/statistics', label: '통계', icon: BarChart3 },
        { path: '/employees', label: '직원 관리', icon: Users },
        { path: '/salary-components', label: '수당/공제 관리', icon: BarChart3 }, // Using BarChart3 temporarily or another icon
        { path: '/settings', label: '설정', icon: Settings },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                        <Calculator className="w-6 h-6" />
                        IncenCalc
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-gray-200 space-y-4">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 w-full transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        로그아웃
                    </button>
                    <p className="text-xs text-gray-400 text-center">v2.0.0 Management System</p>
                </div>
            </aside>

            {/* Mobile Header (Visible only on small screens) */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10 p-4 flex justify-between items-center">
                <h1 className="text-lg font-bold text-blue-600">IncenCalc</h1>
                <button onClick={handleLogout} className="text-gray-500">
                    <LogOut size={20} />
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-auto md:ml-0 mt-14 md:mt-0">
                <Outlet />
            </main>
        </div>
    );
}
