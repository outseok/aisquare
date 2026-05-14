FROM amazonlinux:2023 AS builder

RUN dnf install -y clamav clamav-update python3.11 && \
    freshclam && \
    dnf clean all

FROM public.ecr.aws/lambda/python:3.11

COPY --from=builder /usr/bin/clamscan /usr/bin/clamscan
COPY --from=builder /usr/bin/freshclam /usr/bin/freshclam
COPY --from=builder /usr/lib64/libclamav* /usr/lib64/
COPY --from=builder /usr/lib64/libmspack* /usr/lib64/
COPY --from=builder /usr/lib64/libtfm* /usr/lib64/
COPY --from=builder /usr/lib64/libprelude* /usr/lib64/
COPY --from=builder /usr/lib64/libjson-c* /usr/lib64/
COPY --from=builder /var/lib/clamav /var/lib/clamav
COPY --from=builder /etc/freshclam.conf /etc/freshclam.conf

COPY app.py ${LAMBDA_TASK_ROOT}/

CMD ["app.lambda_handler"]
