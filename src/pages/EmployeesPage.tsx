import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Trash2, Plus, Settings } from 'lucide-react';
import { SalarySettingsModal } from '../components/SalarySettingsModal';

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

export function EmployeesPage() {
    const queryClient = useQueryClient();

    // Fetch Employees
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            // We need to fetch base_salary from the new settings table ideally, 
            // but for now let's stick to the employees table for the list view 
            // and rely on the modal for details.
            // However, we migrated base_salary to settings. 
            // Let's fetch employees and we can fetch their base salary via a join or just show a "Settings" button.
            // For simplicity in this view, let's just show the "Settings" button.
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('name');
            if (error) throw error;
            return data as Employee[];
        }
    });

    // Fetch Stores from Settings
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    });

    // Parse stores from JSONB
    const stores: string[] = settings?.stores ? (typeof settings.stores === 'string' ? JSON.parse(settings.stores) : settings.stores) : [];

    // Inline Editing State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // Modal State
    const [salaryModalEmployee, setSalaryModalEmployee] = useState<{ id: number, name: string } | null>(null);

    // New Employee State
    const [newName, setNewName] = useState('');
    const [newPosition, setNewPosition] = useState('기사');
    const [newStoreName, setNewStoreName] = useState('');
    const [newType, setNewType] = useState<'incentive' | 'basic'>('incentive');
    const [newHireDate, setNewHireDate] = useState(new Date().toISOString().split('T')[0]);

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (newEmployee: Omit<Employee, 'id' | 'is_active' | 'base_salary'>) => {
            const { data, error } = await supabase.from('employees').insert([newEmployee]).select().single();
            if (error) throw error;

            // Also initialize default salary settings for the new employee
            // This is handled by the modal later, or we can trigger a default insert here.
            // For now, let's just create the employee.
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setNewName('');
            setNewPosition('기사');
            setNewStoreName('');
            setNewType('incentive');
            setNewHireDate(new Date().toISOString().split('T')[0]);
            document.getElementById('new-name-input')?.focus();
        },
        onError: (error: any) => {
            console.error('Add employee error:', error);
            alert(`직원 추가 실패: ${error.message || '알 수 없는 오류'}`);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<Employee> }) => {
            const { error } = await supabase.from('employees').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setEditingId(null);
            setEditForm({});
            setFocusedField(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
    });

    const handleAdd = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newName.trim()) {
            alert('이름을 입력해주세요.');
            return;
        }
        addMutation.mutate({
            name: newName,
            position: newPosition,
            store_name: newStoreName,
            type: newType,
            hire_date: newHireDate,
            base_salary: 0, // Default, will be set in settings
        });
    };

    const startEditing = (employee: Employee, field: string) => {
        if (editingId === employee.id) return;
        setEditingId(employee.id);
        setEditForm({ ...employee });
        setFocusedField(field);
    };

    const saveEditing = async () => {
        if (!editingId || !editForm) return;
        updateMutation.mutate({ id: editingId, updates: editForm });
    };

    const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        saveEditing();
    };

    const handleDelete = (id: number) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    const calculateTenure = (hireDateStr: string) => {
        if (!hireDateStr) return '-';
        const hireDate = new Date(hireDateStr);
        const today = new Date();

        let years = today.getFullYear() - hireDate.getFullYear();
        let months = today.getMonth() - hireDate.getMonth();

        if (months < 0) {
            years--;
            months += 12;
        }

        if (years === 0 && months === 0) return '1개월 미만';
        return `${years > 0 ? `${years}년 ` : ''}${months}개월`;
    };

    // Helper to render input
    const renderInput = (field: keyof Employee, type: string = 'text', list?: string) => {
        const isFocused = focusedField === field;
        return (
            <input
                type={type}
                list={list}
                value={editForm[field] as string | number || ''}
                onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                autoFocus={isFocused}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
            />
        );
    };

    const renderSelect = (field: keyof Employee, options: { value: string, label: string }[]) => {
        const isFocused = focusedField === field;
        return (
            <select
                value={editForm[field] as string}
                onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                autoFocus={isFocused}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">직원 관리 (Cloud)</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">이름</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">직급</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">점포명</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">입사일자</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">근무연수</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">급여 유형</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">급여 설정</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* Add New Row */}
                            <tr className="bg-blue-50">
                                <td className="px-4 py-3">
                                    <input
                                        id="new-name-input"
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="이름"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        value={newPosition}
                                        onChange={(e) => setNewPosition(e.target.value)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="공장장">공장장</option>
                                        <option value="팀장">팀장</option>
                                        <option value="선임기사">선임기사</option>
                                        <option value="기사">기사</option>
                                        <option value="수습">수습</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="text"
                                        list="store-list"
                                        value={newStoreName}
                                        onChange={(e) => setNewStoreName(e.target.value)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="점포"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="date"
                                        value={newHireDate}
                                        onChange={(e) => setNewHireDate(e.target.value)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    -
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value as 'incentive' | 'basic')}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="incentive">인센티브</option>
                                        <option value="basic">기본급</option>
                                    </select>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-400">
                                    (생성 후 설정)
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => handleAdd()}
                                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                        title="추가"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </td>
                            </tr>

                            {/* Employee List */}
                            {employees?.map((employee) => (
                                <tr
                                    key={employee.id}
                                    className={`hover:bg-gray-50 ${editingId === employee.id ? 'bg-blue-50' : ''}`}
                                    onBlur={editingId === employee.id ? handleRowBlur : undefined}
                                >
                                    {editingId === employee.id ? (
                                        // Editing Mode
                                        <>
                                            <td className="px-4 py-3">{renderInput('name')}</td>
                                            <td className="px-4 py-3">
                                                {renderSelect('position', [
                                                    { value: '공장장', label: '공장장' },
                                                    { value: '팀장', label: '팀장' },
                                                    { value: '선임기사', label: '선임기사' },
                                                    { value: '기사', label: '기사' },
                                                    { value: '수습', label: '수습' },
                                                    { value: '기타', label: '기타' }
                                                ])}
                                            </td>
                                            <td className="px-4 py-3">{renderInput('store_name', 'text', 'store-list')}</td>
                                            <td className="px-4 py-3">{renderInput('hire_date', 'date')}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{calculateTenure(editForm.hire_date || employee.hire_date)}</td>
                                            <td className="px-4 py-3">
                                                {renderSelect('type', [
                                                    { value: 'incentive', label: '인센티브' },
                                                    { value: 'basic', label: '기본급' }
                                                ])}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => setSalaryModalEmployee({ id: employee.id, name: employee.name })}
                                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium flex items-center justify-center mx-auto"
                                                >
                                                    <Settings size={14} className="mr-1" /> 설정
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleDelete(employee.id)} className="text-gray-400 hover:text-red-600" tabIndex={-1}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        // View Mode
                                        <>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 cursor-pointer" onClick={() => startEditing(employee, 'name')}>{employee.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 cursor-pointer" onClick={() => startEditing(employee, 'position')}>{employee.position}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 cursor-pointer" onClick={() => startEditing(employee, 'store_name')}>{employee.store_name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 cursor-pointer" onClick={() => startEditing(employee, 'hire_date')}>{employee.hire_date}</td>
                                            <td className="px-4 py-3 text-sm text-blue-600 font-medium">{calculateTenure(employee.hire_date)}</td>
                                            <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => startEditing(employee, 'type')}>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${employee.type === 'incentive' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {employee.type === 'incentive' ? '인센티브' : '기본급'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => setSalaryModalEmployee({ id: employee.id, name: employee.name })}
                                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium flex items-center justify-center mx-auto"
                                                >
                                                    <Settings size={14} className="mr-1" /> 설정
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleDelete(employee.id)} className="text-gray-400 hover:text-red-600">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}

                            {employees?.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        등록된 직원이 없습니다. 위 입력란을 통해 추가해주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <datalist id="store-list">
                {stores?.map((store) => (
                    <option key={store} value={store} />
                ))}
            </datalist>

            {salaryModalEmployee && (
                <SalarySettingsModal
                    employeeId={salaryModalEmployee.id}
                    employeeName={salaryModalEmployee.name}
                    onClose={() => setSalaryModalEmployee(null)}
                />
            )}
        </div>
    );
}
