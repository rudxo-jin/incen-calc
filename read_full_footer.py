import pandas as pd

pd.set_option('display.max_colwidth', None)
pd.set_option('display.max_rows', None)

try:
    df = pd.read_excel('근로소득_간이세액표(조견표).xlsx', header=None)
    # Get last 15 rows
    last_rows = df.tail(15)
    
    for index, row in last_rows.iterrows():
        # Join all non-null values in the row
        row_values = [str(val) for val in row.values if pd.notna(val)]
        print(f"Row {index}: {' | '.join(row_values)}")

except Exception as e:
    print(f"Error: {e}")
