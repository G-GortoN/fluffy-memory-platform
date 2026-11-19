import argparse
import http.cookiejar
import json
import os
import urllib.error
import urllib.request
import uuid


class Session:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def request(self, path, method='GET', payload=None, *, expected=200, csrf=True):
        headers = {'Accept': 'application/json'}
        if csrf and method != 'GET':
            headers['X-CSRF-TOKEN'] = self.request('/api/auth/csrf')['token']
        body = None
        if payload is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(payload).encode('utf-8')
        request = urllib.request.Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            data = response.read()
            if response.status != expected:
                raise AssertionError(f'{method} {path} returned {response.status}, expected {expected}')
            return json.loads(data) if data else None


def verify(base_url):
    guest = Session(base_url)
    customer = Session(base_url)
    guest.request('/api/auth/me', expected=401)
    products = guest.request('/api/products')
    bowl = next(product for product in products if product['category'] == 'BOWLS')
    variant = next(variant for variant in bowl['variants'] if variant['stock'] > 0)
    customer.request('/api/auth/register', 'POST', {
        'name': 'Fluffy Memory QA',
        'email': f'smoke-{uuid.uuid4().hex}@example.test',
        'password': uuid.uuid4().hex,
    })
    assert customer.request('/api/auth/me')['role'] == 'CUSTOMER'
    customer.request('/api/admin/products', expected=403)

    cat = customer.request('/api/pets', 'POST', {'name': '芋圆', 'species': 'CAT', 'ageMonths': 28})
    dog = customer.request('/api/pets', 'POST', {'name': '团团', 'species': 'DOG', 'ageMonths': 70})
    assert customer.request(f'/api/pets/{cat["id"]}/care'), 'Unknown breed should get care guidance'
    memorial = customer.request('/api/memorials', 'POST', {
        'petId': dog['id'], 'title': '想念团团', 'story': '一起散步的日子', 'template': 'CORNER',
    })
    assert not memorial['shareEnabled']
    pets = {pet['id']: pet for pet in customer.request('/api/pets')}
    assert pets[cat['id']]['status'] == 'ACTIVE'
    assert pets[dog['id']]['status'] == 'DECEASED'
    guest.request(f'/api/memorials/{memorial["id"]}', expected=401)
    share = f'/api/memorials/{memorial["id"]}/share'
    token = customer.request(share, 'POST')['token']
    assert guest.request(f'/api/shared/{token}')['title'] == memorial['title']
    customer.request(share, 'DELETE', expected=204)
    guest.request(f'/api/shared/{token}', expected=404)

    line = customer.request('/api/cart', 'POST', {'variantId': variant['id'], 'quantity': 1}, expected=201)
    checkout = {
        'cartIds': [line['id']], 'recipient': '演示收件人', 'phone': '13800000000',
        'address': '测试地址，自动化验收专用', 'requestId': str(uuid.uuid4()),
    }
    order = customer.request('/api/orders', 'POST', checkout, expected=201)
    assert order['status'] == 'PENDING_PAYMENT'
    assert order['subtotalCents'] == variant['priceCents']
    assert customer.request('/api/orders', 'POST', checkout, expected=201)['id'] == order['id']
    order_path = f'/api/orders/{order["id"]}'
    assert customer.request(order_path + '/pay', 'POST')['status'] == 'PAID'
    assert customer.request(order_path + '/pay', 'POST')['status'] == 'PAID'
    customer.request(order_path + '/refund', 'POST', {'reason': '验证退款流程'})

    if os.getenv('APP_ADMIN_EMAIL') and os.getenv('APP_ADMIN_PASSWORD'):
        admin = Session(base_url)
        account = admin.request('/api/auth/login', 'POST', {
            'email': os.environ['APP_ADMIN_EMAIL'], 'password': os.environ['APP_ADMIN_PASSWORD'],
        })
        assert account['role'] == 'ADMIN'
        assert admin.request('/api/admin/care')
        refund = admin.request(f'/api/admin/orders/{order["id"]}/refund', 'POST', {'approve': True})
        assert refund['status'] == 'REFUNDED'
        assert customer.request(order_path)['status'] == 'REFUNDED'
        fresh_bowl = guest.request(f'/api/products/{bowl["id"]}')
        stock = next(item['stock'] for item in fresh_bowl['variants'] if item['id'] == variant['id'])
        assert stock == variant['stock'], 'Refund should restore unshipped stock'
    print('Fluffy Memory account, care, memorial sharing, checkout and simulated payment passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Exercise Fluffy Memory with synthetic data in a simulated-payment environment.')
    parser.add_argument('--base-url', required=True)
    verify(parser.parse_args().base_url)
