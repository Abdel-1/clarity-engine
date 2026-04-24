import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.tasks import process_document

try:
    # We will just pass a dummy text file to test the pipeline
    with open("dummy_test.txt", "w") as f:
        f.write("This is a dummy document for testing the Clarity Engine AI pipeline.")
    
    print("Testing process_document...")
    result = process_document("dummy_test.txt")
    print("SUCCESS:")
    print(result)
except Exception as e:
    import traceback
    print("ERROR OCCURRED:")
    traceback.print_exc()
