import pandas as pd

try:
    df = pd.read_excel('근로소득_간이세액표(조견표).xlsx', header=None)
    
    # Search for rows containing specific keywords
    for index, row in df.iterrows():
        row_str = row.to_string()
        if "10,000" in row_str or "초과" in row_str:
            print(f"Row {index}:")
            print(row.values)
            print("-" * 20)
            
except Exception as e:
    print(f"Error: {e}")
