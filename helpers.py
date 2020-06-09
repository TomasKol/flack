def correctString(str):
  return str.encode('latin1').decode('UTF-8')

def correctDict(data):
  for element in data:
    if isinstance(data[element], str):
      data[element] = correctString(data[element])
  return data