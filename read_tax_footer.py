import pandas as pd

try:
    # Load the excel file without header to see all rows
    df = pd.read_excel('근로소득_간이세액표(조견표).xlsx', header=None)
    
    # Print the last 20 rows to find the description
    print(df.tail(20).to_string())
    
except Exception as e:
    print(f"Error: {e}")
