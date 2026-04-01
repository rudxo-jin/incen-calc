import json
with open('src/data/tax_table.json', encoding='utf-8') as f:
    data = json.load(f)
    last = data[-1]
    print(f"Max: {last['max']}")
    print(f"Tax for 2: {last['taxes']['2']}")
