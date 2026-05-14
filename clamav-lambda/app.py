import json
import boto3
import subprocess
import tempfile
import os

s3 = boto3.client('s3')

def lambda_handler(event, context):
    bucket = event.get('bucket')
    key = event.get('key')

    if not bucket or not key:
        return {'infected': False, 'viruses': []}

    # ClamAV 정의 업데이트 (cold start 시)
    try:
        subprocess.run(['freshclam', '--quiet'], timeout=60, check=False)
    except Exception:
        pass

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(key)[-1]) as tmp:
        tmp_path = tmp.name

    try:
        s3.download_file(bucket, key, tmp_path)

        result = subprocess.run(
            ['clamscan', '--no-summary', tmp_path],
            capture_output=True,
            text=True,
            timeout=120,
        )

        infected = result.returncode == 1
        viruses = []

        if infected:
            for line in result.stdout.splitlines():
                if 'FOUND' in line:
                    virus_name = line.split(':')[-1].replace('FOUND', '').strip()
                    viruses.append(virus_name)

        return {'infected': infected, 'viruses': viruses}

    except Exception as e:
        print(f'Scan error: {e}')
        return {'infected': False, 'viruses': [], 'error': str(e)}

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
