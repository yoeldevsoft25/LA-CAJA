import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../database/entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(storeId: string, dto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      document_id: dto.document_id || null,
      phone: dto.phone || null,
      note: dto.note || null,
      updated_at: new Date(),
    });

    return this.customerRepository.save(customer);
  }

  async findAll(storeId: string, search?: string): Promise<Customer[]> {
    const query = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.store_id = :storeId', { storeId });

    if (search) {
      query.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.document_id ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('customer.name', 'ASC');

    return query.getMany();
  }

  async findOne(storeId: string, customerId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, store_id: storeId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async update(
    storeId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(storeId, customerId);

    if (dto.name !== undefined) {
      customer.name = dto.name;
    }
    if (dto.phone !== undefined) {
      customer.phone = dto.phone || null;
    }
    if (dto.note !== undefined) {
      customer.note = dto.note || null;
    }
    customer.updated_at = new Date();

    return this.customerRepository.save(customer);
  }
}
