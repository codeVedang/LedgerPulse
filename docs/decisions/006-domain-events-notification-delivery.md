# ADR 006: In-process domain events with an outbox upgrade path

## Context

Controllers should not construct notifications, and new delivery channels should not alter transaction logic.

## Decision

Publish typed domain events after successful transaction commit. Notification policy maps facts to messages and sends them through `NotificationChannel` adapters. Implement in-app persistence and an optional development console adapter.

## Alternatives considered

- Notification creation in controllers: tightly couples HTTP flows and misses non-HTTP mutations.
- Kafka/RabbitMQ: disproportionate infrastructure for the assignment.
- Transactional outbox now: strongest delivery semantics but adds a worker and operational surface beyond the hiring signal.

## Trade-offs

An in-process event can be lost if the API crashes immediately after commit. The event interface is intentionally compatible with a future transactional outbox; the limitation remains explicit.

