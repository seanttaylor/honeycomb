
## **Honeycomb |  A simply sweet cloud application runtime**

# Table of Contents
1. [Introduction](#introduction)
2. [HC2Gateway](#hc2-gateway)

## Introducing Honeycomb Cloud Platform <a name="introduction"></a>

Honeycomb Cloud Platform (HCP) is a self-hosted, hardware-aware cloud platform designed to run real application workloads on infrastructure you own and understand. It provides a coherent runtime, orchestration, routing, and storage model without relying on opaque hyperscaler abstractions.

### The Problem Addressed

Modern cloud platforms optimize for scale and convenience at the cost of transparency, determinism, and control. As systems grow, they often become difficult to reason about, expensive to operate, and tightly coupled to vendor-specific primitives. HCP is designed to counter this trend by offering a simpler, more inspectable platform that makes infrastructure behavior explicit rather than hidden.

### Why It Exists
HCP exists to make infrastructure legible again. Its philosophy is that small, understandable systems—when composed carefully—can outperform large, monolithic platforms in reliability, adaptability, and operator confidence. Instead of abstracting hardware away entirely, HCP treats it as a first-class concern and builds upward from it.

### Who it's For

HCP is for engineers and teams who want deep control over their infrastructure, are comfortable operating their own systems, and value clarity over convenience. It is particularly suited to homelab-scale clouds, edge deployments, research systems, and organizations seeking independence from traditional cloud providers.

---

## Design Goals

### Simplicity over accidental complexity

HCP aims to minimize the number of moving parts required to run applications. Each component exists for a clear reason, with sharply defined responsibilities.

### Explicit control over infrastructure and deployment

Nothing in HCP happens “by magic.” Deployment, routing, storage, and runtime behavior are deliberate and inspectable, allowing operators to understand exactly how applications are running.

### Deterministic, inspectable systems

HCP favors deterministic behavior over adaptive heuristics. Systems should behave the same way given the same inputs, and their state should always be observable.

### Hardware-aware cloud primitives

Rather than pretending hardware does not matter, HCP is designed with the constraints and capabilities of physical machines in mind, including resource limits, topology, and failure characteristics.

### Small, composable components over monoliths

HCP is built from discrete components that can be reasoned about independently and composed together, rather than a single, tightly coupled control plane.

---

## High-Level Architecture

### How HCP is layered

At a high level, HCP is layered from hardware upward through abstraction, runtime, and application services. Each layer exposes clear contracts to the layer above it while remaining grounded in the realities of the layer below.

### Relationship between hardware, runtime, services, and storage

Physical hardware is abstracted by HC0, which provides a consistent substrate for the platform. HC2 provides the application runtime on top of this substrate. HC2 services run within that runtime and communicate through HC2Gateway. HC3 provides static, content-addressable storage used across the platform.

### How data and requests move through the platform

Requests typically enter the system through HC2Gateway, which routes them to the appropriate HC2 service. Services may read from or write to HC3 as needed, while HC2 and the HC2 Agent ensure the services are running on available hardware.

### Control plane vs. application plane

HCP maintains a conceptual separation between control responsibilities (orchestration, deployment, routing) and application execution. This separation keeps application logic simple while allowing the platform to manage lifecycle and infrastructure concerns.

---

## Core Platform Components

### HC2 | Cloud Application Runtime

#### Role of HC2 in the platform

HC2 is the core runtime responsible for executing application services. It provides the environment in which services run and defines how they are started, managed, and observed.

#### What “runtime” means in the context of HCP

In HCP, the runtime is not a black box. HC2 defines clear expectations around process execution, resource usage, and service boundaries, making it easier to reason about application behavior.

#### Boundaries and Responsibilities

HC2 is responsible for running services, not orchestrating hardware or handling routing directly. Those concerns are delegated to other components to keep the runtime focused and predictable.

---

### HC2 Services

#### What constitutes an HC2 service

An HC2 service is an application component designed to run within the HC2 runtime. Services are treated as first-class units of deployment and operation.

#### How services are deployed and run conceptually

Services are deployed via the HC2 Agent and executed by the HC2 runtime. Their lifecycle is managed by the platform rather than ad hoc scripts or manual intervention.

#### How services are intended to scale and evolve

HCP favors deliberate scaling and evolution of services over automatic elasticity. Growth is explicit, controlled, and observable rather than reactive and opaque.

---

### HC2Gateway | Routing and Communications Broker

#### Why a dedicated proxy exists

HC2Gateway centralizes routing and communication concerns so services do not need to embed complex networking logic. This simplifies service design and improves consistency.

#### How it mediates service-to-service communication

HC2Gateway acts as an intermediary for requests between services, handling routing decisions, discovery, and isolation concerns.

#### Its role in discovery, routing, and isolation

By managing how services find and talk to one another, HC2Gateway enforces clear boundaries and reduces unintended coupling between components.

---

### HC2 Agent (Bumblebee) | Orchestration and Deployment

#### What Bumblebee is responsible for

The HC2 Agent, known as Bumblebee, is responsible for deploying services, standing up containers, and ensuring the runtime state matches the desired state.

#### How it interacts with the runtime and hardware

Bumblebee bridges the gap between intent and execution, coordinating with HC2 and the underlying hardware through HC0 to bring applications online.

#### Why orchestration is handled this way in HCP

Rather than embedding orchestration logic everywhere, HCP centralizes it in a single agent to reduce complexity and make system behavior easier to trace.

---

### HC3 | Content-Addressable Static Storage

#### What HC3 stores and why

HC3 stores deploymen artifacts using content-addressable identifiers, ensuring immutability and integrity.

#### Why content-addressable storage is a core primitive

Content-addressable storage makes artifacts verifiable, cacheable, and reusable, reducing ambiguity about what is running where.

#### How HC3 fits into application delivery and runtime needs

HC3 supports application deployment and runtime behavior by providing a stable, inspectable source of static content used across the platform.

---

### HC0 Hardware Abstraction Layer

#### Purpose of HC0

HC0 abstracts the underlying physical hardware into a consistent interface that the rest of the platform can depend on.

#### What hardware details it hides or exposes

HC0 hides unnecessary variability while still exposing meaningful hardware characteristics that matter for scheduling and performance.

#### Why HCP treats hardware as a first-class concern

By acknowledging hardware explicitly, HCP avoids the false assumption that all compute is interchangeable, leading to more predictable systems.

---

## Bare Metal Infrastructure

HCP ultimately runs on bare-metal infrastructure, currently centered around a Raspberry Pi cluster. While this physical layer is foundational to the platform’s philosophy, its design and operation will be documented separately as it continues to evolve.

---

## HC2Gateway <a name="hc2-gateway"></a>

> Gist: HC2Gateway is the ingress, routing, and service exposure layer for an HC2 instance, controlling how traffic—internal and external—reaches running services.

### Summary

HC2Gateway is the network-facing gateway for a single HC2 instance. It is responsible for receiving incoming requests, determining where those requests should go, and forwarding them to either the HC2 runtime itself or to one of the services registered under that instance. 

This platform component is also the sole mechanism by which HC2 services may be exposed to the public internet, making it a critical boundary between the platform’s internal topology and external traffic.

By centralizing ingress, discovery, and routing, HC2Gateway simplifies service design while enforcing clear and inspectable control over how traffic enters the system.

#### Purpose and Responsibilities

HC2Gateway exists to act as the authoritative front door for an HC2 instance. All inbound traffic—whether originating from within Honeycomb or from outside the platform—flows through it.

Its core responsibilities are to:

* Receive and accept HTTP traffic on behalf of an HC2 instance.

* Route requests to the appropriate destination, either the HC2 runtime itself or a registered HC2 service.

* Maintain awareness of which services are currently active and routable.

* Enforce the rule that services are not directly exposed to the network without passing through the gateway.

* Provide a single, consistent place to reason about ingress, routing, and service exposure.

HC2Gateway is deliberately not an application participant. It does not implement business logic, transform domain data, or make application-level decisions. 

Its job is to move traffic correctly and predictably, _not to interpret it_.

#### Lifecycle and Behavior

HC2Gateway is started as part of an HC2 instance’s operational footprint. On startup, it initializes its routing layer and establishes visibility into the current set of registered services associated with that instance.

As services are deployed, updated, or removed, HC2Gateway continuously updates its internal view of available service profiles. This allows it to make routing decisions based on the current state of the instance rather than static configuration.

During steady-state operation, HC2Gateway:

* Accepts incoming requests.

* Determines whether the request targets the HC2 instance itself or a specific service.

* Forwards the request to the appropriate destination without embedding service-specific assumptions.

HC2Gateway remains long-lived relative to individual services. Services may come and go, but the gateway persists as the stable routing surface for the instance.

#### Interactions with other HCP Components

HC2Gateway sits at the intersection of several core Honeycomb components:

* **HC2 Runtime**:
HC2Gateway proxies certain requests directly to the HC2 instance, acting as the access point for runtime-level endpoints and capabilities.

* **HC2 Services**:
Services do not expose themselves directly. Instead, they register with the HC2 instance, and HC2Gateway routes traffic to them based on that registration data.

* **HC2 Agent (Bumblebee)**:
While HC2Gateway does not orchestrate services itself, its routing state reflects the outcomes of Bumblebee’s deployment and lifecycle decisions.

* **Overall HCP topology**:
HC2Gateway defines the network boundary of an HC2 instance. From the outside, it represents “the instance,” even though internally that instance may be running many services. This positioning allows other components to remain simpler, as they can rely on the gateway to handle ingress and routing concerns.

### Guarantees and Invariants

HC2Gateway upholds several important invariants within the platform:

There is a single authoritative ingress point per HC2 instance.

No HC2 service is reachable without going through HC2Gateway.

Routing decisions are based on explicit service registration data, not ad hoc configuration.

The gateway’s behavior is independent of service implementation details; services are treated as opaque routing targets.

These guarantees make it possible to reason about connectivity, exposure, and traffic flow without needing to inspect individual services.

#### Failure Modes and Edge Cases

**_Service registration data is incomplete or stale_**: If HC2Gateway’s view of registered services is incomplete or out of date, routing decisions may temporarily fail or default to rejecting requests for affected services. 
The gateway does not attempt to infer or guess service availability; it relies on explicit registration data. This bias toward correctness over optimism avoids accidentally routing traffic to unintended destinations.

**_Unavailable or unhealthy services_**:
When a service is unavailable or unhealthy, HC2Gateway will still attempt to route requests according to its current view of service state. Failed requests surface naturally as upstream errors rather than being masked or transformed by the gateway. This preserves transparency and ensures failures remain visible to operators and clients.

#### Operational and Mental Models

The simplest correct way to think about HC2Gateway is as the front door and traffic cop for an HC2 instance.

* It is the only door through which traffic enters.

* It does not decide what should happen to requests—only where they should go.

* It enforces separation between the outside world and internal services.

* It provides a stable, inspectable choke point for networking concerns.

If HC2 is “the building” and HC2 services are “the rooms,” HC2Gateway is the lobby desk: every visitor passes through it, directions are given there, and no one reaches a room without being routed correctly.