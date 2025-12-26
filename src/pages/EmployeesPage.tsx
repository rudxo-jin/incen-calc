import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Trash2, Plus } from 'lucide-react';

interface Employee {
    id: number;
    name: string;
    position: string;
    store_name: string;
    type: 'incentive' | 'basic';
    base_salary: number;
    is_active: boolean;
}

export function EmployeesPage() {
    const queryClient = useQueryClient();

    // Fetch Employees
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
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

    // New Employee State
    const [newName, setNewName] = useState('');
    const [newPosition, setNewPosition] = useState('기사');
    const [newStoreName, setNewStoreName] = useState('');
    const [newType, setNewType] = useState<'incentive' | 'basic'>('incentive');
    const [newBaseSalary, setNewBaseSalary] = useState(0);

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (newEmployee: Omit<Employee, 'id' | 'is_active'>) => {
            const { error } = await supabase.from('employees').insert([newEmployee]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setNewName('');
            setNewPosition('기사');
            setNewStoreName('');
            setNewType('incentive');
            setNewBaseSalary(0);
            document.getElementById('new-name-input')?.focus();
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
            base_salary: Number(newBaseSalary),
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">이름</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">직급</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">점포명</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">급여 유형</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">기본급</th>
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
                                        placeholder="이름 입력"
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
                                        placeholder="점포 선택"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value as 'incentive' | 'basic')}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="incentive">인센티브 대상</option>
                                        <option value="basic">기본급 전용</option>
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="number"
                                        value={newBaseSalary}
                                        onChange={(e) => setNewBaseSalary(Number(e.target.value))}
                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                        placeholder="0"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                    />
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
                                            <td className="px-4 py-3">
                                                {renderSelect('type', [
                                                    { value: 'incentive', label: '인센티브 대상' },
                                                    { value: 'basic', label: '기본급 전용' }
                                                ])}
                                            </td>
                                            <td className="px-4 py-3">{renderInput('base_salary', 'number')}</td>
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
                                            <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => startEditing(employee, 'type')}>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${employee.type === 'incentive' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {employee.type === 'incentive' ? '인센티브' : '기본급'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right cursor-pointer" onClick={() => startEditing(employee, 'base_salary')}>{employee.base_salary?.toLocaleString()}</td>
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
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
        </div>
    );
}
