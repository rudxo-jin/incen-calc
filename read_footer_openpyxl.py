import openpyxl

try:
    wb = openpyxl.load_workbook('근로소득_간이세액표(조견표).xlsx', data_only=True)
    sheet = wb.active
    
    # Iterate from row 650 to max row
    for row in sheet.iter_rows(min_row=650, values_only=True):
        # Filter out None values
        values = [str(v) for v in row if v is not None]
        if values:
            print(f"Row: {' | '.join(values)}")
            
except Exception as e:
    print(f"Error: {e}")
