import json
import math

# Load tax table
with open('src/data/tax_table.json', 'r', encoding='utf-8') as f:
    tax_table = json.load(f)

def calculate_income_tax(taxable_income, dependents=1):
    if taxable_income <= 0:
        return 0

    # Find row
    row = next((r for r in tax_table if taxable_income >= r['min'] and taxable_income < r['max']), None)

    if not row:
        if taxable_income < tax_table[0]['min']:
            return 0
            
        # High income logic
        last_row = tax_table[-1]
        dependent_key = str(min(dependents, 11))
        base_tax = last_row['taxes'].get(dependent_key, 0)
        
        income = taxable_income
        
        if income <= 14000000:
            return math.floor(base_tax + ((income - 10000000) * 0.98 * 0.35) + 25000)
        
        if income <= 28000000:
            return math.floor(base_tax + 1397000 + ((income - 14000000) * 0.98 * 0.38))
            
        if income <= 30000000:
            return math.floor(base_tax + 6610600 + ((income - 28000000) * 0.98 * 0.40))
            
        # 30M ~ 45M (and above)
        return math.floor(base_tax + 7394600 + ((income - 30000000) * 0.40))

    dependent_key = str(min(dependents, 11))
    return row['taxes'].get(dependent_key, 0)

# Test cases
test_incomes = [
    11000000, # 10M ~ 14M
    20000000, # 14M ~ 28M
    29000000, # 28M ~ 30M
    40000000, # 30M ~ 45M
    10000000  # Boundary
]

print("Verifying Income Tax Calculation:")
for income in test_incomes:
    tax = calculate_income_tax(income, 1)
    print(f"Income: {income:,} KRW -> Tax: {tax:,} KRW")
