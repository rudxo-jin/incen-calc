import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Save, X, Filter, ArrowUpDown, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SalaryComponent {
    id: number;
    name: string;
    type: 'allowance' | 'deduction';
    is_taxable: boolean;
    is_fixed: boolean;
    default_amount: number;
    formula?: string;
    sort_order: number;
}

// Variable Name Mapping
const variableNameMapping: Record<string, string> = {
    'taxable_income': '과세소득',
    'health_insurance': '건강보험료',
    'income_tax': '소득세',
    'total_pay': '총지급액'
};

const getDisplayVariable = (formula: string) => {
    if (!formula) return '';
    const base = formula.split('*')[0].trim();
    return variableNameMapping[base] || base;
};

// Sortable Row Component
function SortableRow({ comp, editingId, editForm, setEditForm, saveEditing, setEditingId, startEditing, handleDelete, sortBy }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: comp.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' as const : undefined,
        backgroundColor: isDragging ? '#f3f4f6' : undefined,
        boxShadow: isDragging ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : undefined,
    };

    if (editingId === comp.id) {
        return (
            <tr ref={setNodeRef} style={style} className="bg-blue-50/50">
                <td className="px-6 py-4 text-center">
                    <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                        <GripVertical size={16} />
                    </button>
                </td>
                <td className="px-6 py-4">
                    <select
                        value={editForm.type}
                        onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                        className="p-1 border rounded text-sm"
                    >
                        <option value="allowance">수당</option>
                        <option value="deduction">공제</option>
                    </select>
                </td>
                <td className="px-6 py-4">
                    <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full p-1 border rounded text-sm"
                    />
                </td>
                <td className="px-6 py-4 text-right">
                    <input
                        type="number"
                        value={editForm.default_amount}
                        onChange={e => setEditForm({ ...editForm, default_amount: Number(e.target.value) })}
                        className="w-full p-1 border rounded text-sm text-right"
                    />
                </td>
                <td className="px-6 py-4">
                    {editForm.formula && editForm.formula.includes('*') ? (
                        <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1 rounded whitespace-nowrap">
                                {getDisplayVariable(editForm.formula)} *
                            </span>
                            <input
                                type="number"
                                step="0.00001"
                                value={editForm.formula.split('*')[1].trim()}
                                onChange={e => {
                                    const base = editForm.formula?.split('*')[0].trim();
                                    setEditForm({ ...editForm, formula: `${base} * ${e.target.value}` });
                                }}
                                className="w-20 p-1 border rounded text-sm font-mono text-xs"
                            />
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={editForm.formula || ''}
                            onChange={e => setEditForm({ ...editForm, formula: e.target.value })}
                            className="w-full p-1 border rounded text-sm font-mono text-xs"
                            placeholder="예: taxable_income * 0.045"
                        />
                    )}
                </td>
                <td className="px-6 py-4 text-center space-x-3">
                    <label className="inline-flex items-center space-x-1">
                        <input
                            type="checkbox"
                            checked={editForm.is_taxable}
                            onChange={e => setEditForm({ ...editForm, is_taxable: e.target.checked })}
                        />
                        <span className="text-xs">과세</span>
                    </label>
                    <label className="inline-flex items-center space-x-1">
                        <input
                            type="checkbox"
                            checked={editForm.is_fixed}
                            onChange={e => setEditForm({ ...editForm, is_fixed: e.target.checked })}
                        />
                        <span className="text-xs">고정</span>
                    </label>
                </td>
                <td className="px-6 py-4 text-center space-x-2">
                    <button onClick={saveEditing} className="text-blue-600 hover:text-blue-800"><Save size={18} /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700"><X size={18} /></button>
                </td>
            </tr>
        );
    }

    return (
        <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 bg-white">
            <td className="px-6 py-4 whitespace-nowrap text-center">
                {sortBy === 'order' ? (
                    <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                        <GripVertical size={16} />
                    </button>
                ) : (
                    <span className="text-gray-300">-</span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${comp.type === 'allowance' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    {comp.type === 'allowance' ? '수당' : '공제'}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{comp.name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                {comp.default_amount.toLocaleString()}원
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs truncate max-w-[150px]" title={comp.formula}>
                {comp.formula ? (
                    comp.formula.includes('*') ?
                        `${getDisplayVariable(comp.formula)} * ${comp.formula.split('*')[1].trim()}` :
                        comp.formula
                ) : '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                {comp.is_taxable && <span className="mx-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">과세</span>}
                {comp.is_fixed && <span className="mx-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">고정급</span>}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button onClick={() => startEditing(comp)} className="text-blue-600 hover:text-blue-900 mr-3">수정</button>
                <button onClick={() => handleDelete(comp.id)} className="text-red-600 hover:text-red-900">삭제</button>
            </td>
        </tr>
    );
}

export function SalaryComponentsPage() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Filter & Sort States
    const [filterType, setFilterType] = useState<'all' | 'allowance' | 'deduction'>('all');
    const [sortBy, setSortBy] = useState<'order' | 'name' | 'amount'>('order');

    // Local state for DnD
    const [items, setItems] = useState<SalaryComponent[]>([]);

    // Form States
    const [newComponent, setNewComponent] = useState<Partial<SalaryComponent>>({
        name: '',
        type: 'allowance',
        is_taxable: true,
        is_fixed: true,
        default_amount: 0,
        formula: ''
    });
    const [editForm, setEditForm] = useState<Partial<SalaryComponent>>({});

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fetch Components
    const { data: components, isLoading } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true });
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    // Sync local items with fetched components
    useEffect(() => {
        if (components) {
            setItems(components);
        }
    }, [components]);

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (component: Partial<SalaryComponent>) => {
            // Get max sort_order
            const { data: maxData } = await supabase
                .from('salary_components')
                .select('sort_order')
                .order('sort_order', { ascending: false })
                .limit(1)
                .single();

            const nextOrder = (maxData?.sort_order || 0) + 1;

            const { error } = await supabase.from('salary_components').insert([{ ...component, sort_order: nextOrder }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary_components'] });
            setIsAdding(false);
            setNewComponent({
                name: '',
                type: 'allowance',
                is_taxable: true,
                is_fixed: true,
                default_amount: 0,
                formula: ''
            });
        },
        onError: (error: any) => alert(error.message)
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<SalaryComponent> }) => {
            const { error } = await supabase.from('salary_components').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary_components'] });
            setEditingId(null);
        },
        onError: (error: any) => alert(error.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('salary_components').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary_components'] }),
        onError: (error: any) => alert(error.message)
    });

    const reorderMutation = useMutation({
        mutationFn: async (items: { id: number; sort_order: number }[]) => {
            await Promise.all(items.map(item =>
                supabase.from('salary_components').update({ sort_order: item.sort_order }).eq('id', item.id)
            ));
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary_components'] }),
        onError: (error: any) => alert(error.message)
    });

    const handleAdd = () => {
        if (!newComponent.name) return alert('항목명을 입력해주세요.');
        addMutation.mutate(newComponent);
    };

    const startEditing = (component: SalaryComponent) => {
        setEditingId(component.id);
        setEditForm({ ...component });
    };

    const saveEditing = () => {
        if (!editingId) return;
        updateMutation.mutate({ id: editingId, updates: editForm });
    };

    const handleDelete = (id: number) => {
        if (confirm('정말 삭제하시겠습니까? 이미 급여 설정에 사용 중인 항목일 수 있습니다.')) {
            deleteMutation.mutate(id);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Prepare updates for DB
                // We need to update sort_order for all affected items or just re-assign sort_order based on new index
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    sort_order: index + 1
                }));

                reorderMutation.mutate(updates);

                return newItems;
            });
        }
    };

    // Filter and Sort Logic for Display
    // Note: When dragging, we must use the local 'items' state.
    // Filtering/Sorting disables Dragging usually, or we only allow dragging when not filtered/sorted by other means.

    let displayItems = items;

    // If we are filtering or sorting by something other than order, we might want to disable DnD or handle it carefully.
    // For simplicity, we'll only enable DnD when filter is 'all' and sortBy is 'order'.
    const isDnDEnabled = filterType === 'all' && sortBy === 'order';

    if (filterType !== 'all') {
        displayItems = displayItems.filter(c => c.type === filterType);
    }

    if (sortBy === 'name') {
        displayItems = [...displayItems].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'amount') {
        displayItems = [...displayItems].sort((a, b) => b.default_amount - a.default_amount);
    }

    if (isLoading) return <div className="p-8">로딩 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">수당 및 공제 관리</h2>
                <button
                    onClick={() => setIsAdding(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                    <Plus size={18} className="mr-2" /> 항목 추가
                </button>
            </div>

            {/* Filter & Sort Controls */}
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">필터:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filterType === 'all' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => setFilterType('allowance')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filterType === 'allowance' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            수당
                        </button>
                        <button
                            onClick={() => setFilterType('deduction')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filterType === 'deduction' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            공제
                        </button>
                    </div>
                </div>

                <div className="w-px h-6 bg-gray-200 mx-2 hidden md:block"></div>

                <div className="flex items-center gap-2">
                    <ArrowUpDown size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">정렬:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="text-sm border-none bg-gray-50 rounded-md px-2 py-1 focus:ring-0 cursor-pointer hover:bg-gray-100"
                    >
                        <option value="order">사용자 지정 순서</option>
                        <option value="name">이름순</option>
                        <option value="amount">금액순</option>
                    </select>
                </div>
            </div>

            {isAdding && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 animate-fade-in">
                    <h3 className="font-bold text-blue-800 mb-3">새 항목 추가</h3>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">구분</label>
                            <select
                                value={newComponent.type}
                                onChange={e => setNewComponent({ ...newComponent, type: e.target.value as any })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="allowance">수당 (지급)</option>
                                <option value="deduction">공제 (차감)</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">항목명</label>
                            <input
                                type="text"
                                value={newComponent.name}
                                onChange={e => setNewComponent({ ...newComponent, name: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="예: 야간수당"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">기본 금액</label>
                            <input
                                type="number"
                                value={newComponent.default_amount}
                                onChange={e => setNewComponent({ ...newComponent, default_amount: Number(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">계산식 (비율)</label>
                            {newComponent.formula && newComponent.formula.includes('*') ? (
                                <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1 rounded">
                                        {getDisplayVariable(newComponent.formula)} *
                                    </span>
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={newComponent.formula.split('*')[1].trim()}
                                        onChange={e => {
                                            const base = newComponent.formula?.split('*')[0].trim();
                                            setNewComponent({ ...newComponent, formula: `${base} * ${e.target.value}` });
                                        }}
                                        className="w-full p-2 border rounded font-mono text-xs"
                                    />
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={newComponent.formula || ''}
                                    onChange={e => setNewComponent({ ...newComponent, formula: e.target.value })}
                                    className="w-full p-2 border rounded font-mono text-xs"
                                    placeholder="taxable_income * 0.045"
                                />
                            )}
                        </div>
                        <div className="md:col-span-1 flex space-x-4 py-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newComponent.is_taxable}
                                    onChange={e => setNewComponent({ ...newComponent, is_taxable: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                <span className="text-sm">과세</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newComponent.is_fixed}
                                    onChange={e => setNewComponent({ ...newComponent, is_fixed: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                <span className="text-sm">고정급</span>
                            </label>
                        </div>
                        <div className="md:col-span-1 flex space-x-2">
                            <button onClick={handleAdd} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">저장</button>
                            <button onClick={() => setIsAdding(false)} className="flex-1 bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300">취소</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">순서</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구분</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">항목명</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">기본 금액</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">계산식</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">속성</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isDnDEnabled ? (
                                <SortableContext
                                    items={displayItems.map(i => i.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {displayItems.map((comp) => (
                                        <SortableRow
                                            key={comp.id}
                                            comp={comp}
                                            editingId={editingId}
                                            editForm={editForm}
                                            setEditForm={setEditForm}
                                            saveEditing={saveEditing}
                                            setEditingId={setEditingId}
                                            startEditing={startEditing}
                                            handleDelete={handleDelete}
                                            sortBy={sortBy}
                                        />
                                    ))}
                                </SortableContext>
                            ) : (
                                displayItems.map((comp) => (
                                    <SortableRow
                                        key={comp.id}
                                        comp={comp}
                                        editingId={editingId}
                                        editForm={editForm}
                                        setEditForm={setEditForm}
                                        saveEditing={saveEditing}
                                        setEditingId={setEditingId}
                                        startEditing={startEditing}
                                        handleDelete={handleDelete}
                                        sortBy={sortBy}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </DndContext>
            </div>
        </div>
    );
}
