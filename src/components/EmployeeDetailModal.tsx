import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { X, Save, User, DollarSign, Calendar, Briefcase, Building } from 'lucide-react';

interface Employee {
    id: number;
    name: string;
    position: string;
    store_name: string;
    type: 'incentive' | 'basic';
    base_salary: number;
    hire_date: string;
    is_active: boolean;
}

interface SalaryComponent {
    id: number;
    name: string;
    type: 'allowance' | 'deduction';
    is_fixed: boolean;
    default_amount: number;
}

interface SalarySetting {
    id?: number;
    employee_id: number;
    component_id: number;
    amount: number;
    salary_components?: SalaryComponent;
}

interface Props {
    employeeId: number;
    onClose: () => void;
}

export function EmployeeDetailModal({ employeeId, onClose }: Props) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'basic' | 'salary'>('basic');

    // --- Basic Info State ---
    const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});

    // --- Salary Settings State ---
    const [salarySettings, setSalarySettings] = useState<SalarySetting[]>([]);

    // --- Fetch Data ---
    const { data: employee, isLoading: isEmployeeLoading } = useQuery({
        queryKey: ['employee', employeeId],
        queryFn: async () => {
            const { data, error } = await supabase.from('employees').select('*').eq('id', employeeId).single();
            if (error) throw error;
            return data as Employee;
        }
    });

    const { data: components } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase.from('salary_components').select('*').order('type').order('id');
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    const { data: currentSettings } = useQuery({
        queryKey: ['employee_salary_settings', employeeId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employee_salary_settings')
                .select('*, salary_components(*)')
                .eq('employee_id', employeeId);
            if (error) throw error;
            return data as SalarySetting[];
        }
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error) throw error;
            return data;
        }
    });
    const stores: string[] = settings?.stores ? (typeof settings.stores === 'string' ? JSON.parse(settings.stores) : settings.stores) : [];


    // --- Initialize State ---
    useEffect(() => {
        if (employee) {
            setEmployeeForm(employee);
        }
    }, [employee]);

    useEffect(() => {
        if (currentSettings && components) {
            const merged: SalarySetting[] = components
                .filter(c => c.is_fixed)
                .map(c => {
                    const existing = currentSettings.find(s => s.component_id === c.id);
                    return {
                        employee_id: employeeId,
                        component_id: c.id,
                        amount: existing ? existing.amount : c.default_amount,
                        salary_components: c,
                        id: existing?.id
                    };
                });
            setSalarySettings(merged);
        }
    }, [currentSettings, components, employeeId]);


    // --- Mutations ---
    const updateEmployeeMutation = useMutation({
        mutationFn: async (updates: Partial<Employee>) => {
            const { error } = await supabase.from('employees').update(updates).eq('id', employeeId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
            alert('기본 정보가 저장되었습니다.');
        }
    });

    const updateSalaryMutation = useMutation({
        mutationFn: async (newSettings: SalarySetting[]) => {
            const upsertData = newSettings.map(s => ({
                employee_id: s.employee_id,
                component_id: s.component_id,
                amount: s.amount
            }));
            const { error } = await supabase.from('employee_salary_settings').upsert(upsertData, { onConflict: 'employee_id, component_id' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee_salary_settings'] });
            alert('급여 설정이 저장되었습니다.');
        }
    });

    const handleSaveBasic = () => {
        updateEmployeeMutation.mutate(employeeForm);
    };

    const handleSaveSalary = () => {
        updateSalaryMutation.mutate(salarySettings);
    };

    const handleSalaryChange = (componentId: number, amount: number) => {
        setSalarySettings(prev => prev.map(p =>
            p.component_id === componentId ? { ...p, amount } : p
        ));
    };

    if (isEmployeeLoading || !employee) return null;

    const allowances = salarySettings.filter(s => s.salary_components?.type === 'allowance');
    const deductions = salarySettings.filter(s => s.salary_components?.type === 'deduction');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50">
                    <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                            {employee.name[0]}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{employee.name}</h2>
                            <p className="text-sm text-gray-500">{employee.position} | {employee.store_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={28} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'basic' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <User size={18} className="inline-block mr-2 mb-1" /> 기본 정보
                    </button>
                    <button
                        onClick={() => setActiveTab('salary')}
                        className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'salary' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <DollarSign size={18} className="inline-block mr-2 mb-1" /> 급여 설정
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {activeTab === 'basic' && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={employeeForm.name || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">직급</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <select
                                            value={employeeForm.position || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                        >
                                            <option value="공장장">공장장</option>
                                            <option value="팀장">팀장</option>
                                            <option value="선임기사">선임기사</option>
                                            <option value="기사">기사</option>
                                            <option value="수습">수습</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">점포</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            list="store-list-modal"
                                            value={employeeForm.store_name || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, store_name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <datalist id="store-list-modal">
                                            {stores.map(s => <option key={s} value={s} />)}
                                        </datalist>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">입사일자</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            value={employeeForm.hire_date || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">급여 유형</label>
                                    <select
                                        value={employeeForm.type || 'incentive'}
                                        onChange={e => setEmployeeForm({ ...employeeForm, type: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="incentive">인센티브 대상</option>
                                        <option value="basic">기본급 전용</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-6 flex justify-end">
                                <button
                                    onClick={handleSaveBasic}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm"
                                >
                                    <Save size={18} className="mr-2" /> 기본 정보 저장
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'salary' && (
                        <div className="space-y-8 max-w-3xl mx-auto">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                    <span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span>
                                    지급 항목 (Allowances)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {allowances.map(item => (
                                        <div key={item.component_id}>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                {item.salary_components?.name}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400">₩</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => handleSalaryChange(item.component_id, Number(e.target.value))}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-800"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                    <span className="w-1 h-6 bg-red-500 rounded-full mr-3"></span>
                                    공제 항목 (Deductions)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {deductions.map(item => (
                                        <div key={item.component_id}>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                {item.salary_components?.name}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400">₩</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => handleSalaryChange(item.component_id, Number(e.target.value))}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right font-medium text-gray-800"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    onClick={handleSaveSalary}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm"
                                >
                                    <Save size={18} className="mr-2" /> 급여 설정 저장
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
