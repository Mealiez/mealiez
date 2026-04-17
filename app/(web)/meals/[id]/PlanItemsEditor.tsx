"use client";

import { useState } from 'react';
import { 
  MEAL_TYPE_LABELS, 
  MEAL_TYPE_ORDER, 
  type MealType 
} from '@/lib/validations/meals';

type MealPlanItem = {
  id: string;
  plan_id: string;
  meal_date: string;
  meal_type: MealType;
  name: string;
  description: string | null;
  is_available: boolean;
};

interface Props {
  plan: {
    id: string;
    start_date: string;
    end_date: string;
    meal_plan_items: MealPlanItem[];
  };
  canManage: boolean;
}

export default function PlanItemsEditor({ plan, canManage }: Props) {
  const [items, setItems] = useState<MealPlanItem[]>(plan.meal_plan_items || []);
  const [selectedDate, setSelectedDate] = useState(plan.start_date);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addForm, setAddForm] = useState<{
    meal_type: MealType;
    name: string;
    description: string;
  }>({
    meal_type: 'breakfast',
    name: '',
    description: ''
  });

  const navigateDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    
    if (newDateStr >= plan.start_date && newDateStr <= plan.end_date) {
      setSelectedDate(newDateStr);
      setError(null);
    }
  };

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/meals/plans/${plan.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          meal_date: selectedDate
        })
      });

      const data = await res.json();

      if (res.status === 409) {
        throw new Error("This meal slot is already taken");
      }
      if (!res.ok) throw new Error(data.error || "Failed to add item");

      setItems(prev => [...prev, data]);
      setAddForm({ meal_type: 'breakfast', name: '', description: '' });
      setIsAddingItem(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleAvailability(item: MealPlanItem) {
    const originalItems = [...items];
    const newAvailable = !item.is_available;

    // Optimistic update
    setItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, is_available: newAvailable } : i
    ));

    try {
      const res = await fetch(`/api/meals/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: newAvailable })
      });

      if (!res.ok) throw new Error();
    } catch {
      // Rollback
      setItems(originalItems);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Remove this meal item?')) return;

    try {
      const res = await fetch(`/api/meals/items/${itemId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch {
      setError("Failed to delete item");
    }
  }

  const itemsForSelectedDate = items.filter(i => i.meal_date === selectedDate);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateDate(-1)}
              disabled={selectedDate <= plan.start_date}
              className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <div className="text-lg font-semibold text-gray-900 w-48 text-center">
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric' 
              })}
            </div>
            <button
              onClick={() => navigateDate(1)}
              disabled={selectedDate >= plan.end_date}
              className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
          {canManage && !isAddingItem && (
            <button
              onClick={() => setIsAddingItem(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Meal
            </button>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MEAL_TYPE_ORDER.map(type => {
              const typeItems = itemsForSelectedDate.filter(i => i.meal_type === type);
              return (
                <div key={type} className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {MEAL_TYPE_LABELS[type]}
                  </h3>
                  
                  {typeItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        item.is_available 
                          ? 'bg-white border-gray-200 shadow-sm' 
                          : 'bg-gray-50 border-gray-100 opacity-60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        {canManage && (
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-4">{item.description}</p>
                      
                      {canManage && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">Available</span>
                          <button
                            onClick={() => toggleAvailability(item)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${
                              item.is_available ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                              item.is_available ? 'right-1' : 'left-1'
                            }`} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {typeItems.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-300 italic">
                      No {MEAL_TYPE_LABELS[type].toLowerCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isAddingItem && (
            <div className="mt-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed">
              <h4 className="text-sm font-bold text-blue-900 mb-4">Add Meal to {selectedDate}</h4>
              <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                  <select
                    value={addForm.meal_type}
                    onChange={e => setAddForm(prev => ({ ...prev, meal_type: e.target.value as MealType }))}
                    className="w-full bg-white px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MEAL_TYPE_ORDER.map(t => (
                      <option key={t} value={t}>{MEAL_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input
                    required
                    type="text"
                    value={addForm.name}
                    onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Vegetable Biryani"
                    className="w-full bg-white px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    value={addForm.description}
                    onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description..."
                    className="w-full bg-white px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
