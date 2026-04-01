import pandas as pd
import json
import os

try:
    # Load the excel file
    # Based on inspection, data starts around row 6 (index 5 for header, data follows)
    # But let's be more robust.
    # The columns are: Min, Max, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    
    df = pd.read_excel('근로소득_간이세액표(조견표).xlsx', header=5)
    
    tax_data = []
    
    for index, row in df.iterrows():
        try:
            # Column 0: Min (thousands)
            # Column 1: Max (thousands)
            min_val = row.iloc[0]
            max_val = row.iloc[1]
            
            # Skip if min is not a number (e.g. footer or empty)
            if pd.isna(min_val) or not isinstance(min_val, (int, float)):
                continue
                
            # Handle "Over" case where max might be NaN or string
            if pd.isna(max_val):
                max_val = 999999999 # Large number
            
            entry = {
                "min": int(min_val) * 1000, # Convert to actual won
                "max": int(max_val) * 1000 if isinstance(max_val, (int, float)) else 9999999999,
                "taxes": {}
            }
            
            # Columns 2 to 12 correspond to dependents 1 to 11
            # Note: The table might have specific logic for 11+, but usually it's column 11 value.
            for i in range(1, 12):
                col_idx = i + 1
                if col_idx < len(row):
                    val = row.iloc[col_idx]
                    entry["taxes"][i] = int(val) if pd.notna(val) and isinstance(val, (int, float)) else 0
            
            tax_data.append(entry)
        except Exception as e:
            # print(f"Skipping row {index}: {e}")
            continue
            
    output_path = 'src/data/tax_table.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tax_data, f, ensure_ascii=False)
        
    print(f"Successfully generated {output_path} with {len(tax_data)} entries.")

except Exception as e:
    print(f"Error: {e}")
