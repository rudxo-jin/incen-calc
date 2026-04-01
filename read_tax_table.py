import pandas as pd
import json

try:
    # Load the excel file, skipping initial rows if needed
    # Based on previous output, header seems to be around row 5 (0-indexed)
    df = pd.read_excel('근로소득_간이세액표(조견표).xlsx', header=5)
    
    # Rename columns for clarity (assuming structure)
    # The first two columns are likely range start/end
    # The rest are dependent counts 1 to 11
    
    print("Columns:", df.columns.tolist())
    print(df.head(10).to_string())
    
    # Let's try to create a simplified list of objects
    tax_data = []
    for index, row in df.iterrows():
        try:
            min_inc = row.iloc[0]
            max_inc = row.iloc[1]
            
            # Check if valid row
            if pd.isna(min_inc): continue
            
            entry = {
                "min": min_inc,
                "max": max_inc,
                "taxes": {}
            }
            
            # Columns 2 to 12 correspond to dependents 1 to 11
            for i in range(1, 12):
                col_idx = i + 1
                if col_idx < len(row):
                    entry["taxes"][i] = row.iloc[col_idx]
            
            tax_data.append(entry)
        except Exception as e:
            continue
            
    print(f"\nExtracted {len(tax_data)} rows.")
    print("Sample entry:", tax_data[0] if tax_data else "None")
    
    # Save to json to inspect
    with open('tax_table_preview.json', 'w', encoding='utf-8') as f:
        json.dump(tax_data[:5], f, ensure_ascii=False, indent=2)

except Exception as e:
    print(f"Error: {e}")
