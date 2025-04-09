FROM python:3.13
WORKDIR /code
RUN pip install --no-cache-dir --upgrade pipenv
COPY Pipfile Pipfile.lock /code
RUN pipenv install --system --deploy
COPY . /code
CMD ["fastapi", "run", "app/main.py", "--proxy-headers", "--port", "8888"]
